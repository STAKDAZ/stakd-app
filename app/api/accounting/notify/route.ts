import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { requireInternalUser } from "@/lib/supabase/server-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type NotifyType = "created" | "won" | "completed";

const eventKeyByType: Record<NotifyType, string> = {
  created: "job_created",
  won: "job_won",
  completed: "job_completed",
};

const defaultRecipientsByType: Record<NotifyType, string[]> = {
  created: ["joe@stakdaz.com", "pm@stakdaz.com"],
  won: ["accounting@stakdaz.com", "joe@stakdaz.com", "pm@stakdaz.com"],
  completed: ["accounting@stakdaz.com", "joe@stakdaz.com", "pm@stakdaz.com"],
};

function cleanRecipients(value: unknown, fallback: string[]) {
  const rows = Array.isArray(value) ? value : [];
  const cleaned = rows
    .map((email) => String(email || "").trim().toLowerCase())
    .filter((email) => email.endsWith("@stakdaz.com"));
  return cleaned.length ? Array.from(new Set(cleaned)) : fallback;
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL." },
        { status: 500 }
      );
    }
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
    }

    const auth = await requireInternalUser(req);
    if (auth.response) return auth.response;
    const email = auth.user.email;

    const body = await req.json();
    const type: NotifyType | undefined = body?.type;
    const jobId: string | undefined = body?.job_id;
    const jobNumberInput: string | undefined = body?.job_number;

    if (!type || !["created", "won", "completed"].includes(type) || (!jobId && !jobNumberInput)) {
      return NextResponse.json({ error: "Missing payload. Expected { type, job_id or job_number }." }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return NextResponse.json({ error: "Missing RESEND_API_KEY." }, { status: 500 });

    // 3) Service-role client to read/update jobs regardless of RLS
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Pull job details + names (adjust relationship names if yours differ)
    const { data: job, error: jobErr } = await adminClient
      .from("jobs")
      .select(
        `
        id,
        job_number,
        job_name,
        status,
        quoted_amount,
        percent_complete,
        projected_finish_date,
        po_number,
        po_url,
        rfq_url,
        job_folder_url,
        outsourced_amount,
        created_notified_at,
        won_notified_at,
        bill_ready_notified_at,
        client:clients(name),
        outsourced:subcontractors(name)
      `
      )
      .match(jobId ? { id: jobId } : { job_number: jobNumberInput })
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: jobErr?.message ?? "Job not found." }, { status: 404 });
    }

    // 4) Dedup: don’t email twice
    if (type === "created" && job.created_notified_at) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Already notified (created_notified_at set)." });
    }
    if (type === "won" && job.won_notified_at) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Already notified (won_notified_at set)." });
    }
    if (type === "completed" && job.bill_ready_notified_at) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Already notified (bill_ready_notified_at set)." });
    }

    const resend = new Resend(resendKey);

    const from = process.env.CONCERNS_FROM_EMAIL || "STAKD Portal <no-reply@stakdaz.com>";
    const { data: setting } = await adminClient
      .from("notification_settings")
      .select("recipients")
      .eq("event_key", eventKeyByType[type])
      .maybeSingle();
    const to = cleanRecipients(setting?.recipients, defaultRecipientsByType[type]);

    const jobNumber = job.job_number ?? "—";
    const jobName = job.job_name ?? "—";
    const clientName = (job as any).client?.name ?? "—";
    const poNumber = job.po_number ?? "—";
    const poUrl = job.po_url ?? "";
    const rfqUrl = job.rfq_url ?? "";
    const quotedAmount = job.quoted_amount ?? null;
    const outsourcedName = (job as any).outsourced?.name ?? "—";
    const outsourcedAmount = job.outsourced_amount ?? null;

    let subject = "";
    let header = "";

    if (type === "created") {
      subject = `New Job Created: ${jobNumber} - ${jobName}`;
      header = `A new job has been created in STAKD.`;
    } else if (type === "won") {
      subject = `New Job Won: ${jobNumber} — ${jobName}`;
      header = `We won a new job and it’s ready for accounting setup.`;
    } else {
      subject = `Job Completed (Ready to Bill): ${jobNumber} — ${jobName}`;
      header = `This job has been confirmed 100% complete and can be billed.`;
    }

    const text = [
      header,
      "",
      `Job #: ${jobNumber}`,
      `Job Name: ${jobName}`,
      `Customer: ${clientName}`,
      "",
      quotedAmount != null ? `Total (Quoted $): ${quotedAmount}` : `Total (Quoted $): —`,
      outsourcedAmount != null
        ? `Outsourced ($): ${outsourcedAmount} (${outsourcedName})`
        : `Outsourced ($): —`,
      "",
      `PO #: ${poNumber}`,
      `PO Link: ${poUrl || "—"}`,
      `RFQ Link: ${rfqUrl || "—"}`,
      `Job Folder: ${job.job_folder_url || "—"}`,
      "",
      `Triggered by: ${email}`,
      "",
      "— STAKD Admin",
    ].join("\n");

    await resend.emails.send({
      from,
      to,
      subject,
      text,
      replyTo: email,
    });

    // 5) Stamp the job so we don’t email again
    const stamp =
      type === "created"
        ? { created_notified_at: new Date().toISOString() }
        : type === "won"
        ? { won_notified_at: new Date().toISOString() }
        : { bill_ready_notified_at: new Date().toISOString() };

    const { error: stampErr } = await adminClient.from("jobs").update(stamp).eq("id", job.id);
    if (stampErr) {
      // Email already sent; returning ok but include stamp warning
      return NextResponse.json({ ok: true, warning: `Email sent but failed to stamp job: ${stampErr.message}` });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Failed." }, { status: 500 });
  }
}
