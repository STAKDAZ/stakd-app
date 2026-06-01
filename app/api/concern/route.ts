
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getAuthenticatedUser } from "@/lib/supabase/server-auth";

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Missing or invalid auth token." }, { status: 401 });
    }

    const { job, message } = await req.json();

    if (!message || String(message).trim().length < 3) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json(
        { error: "Missing RESEND_API_KEY environment variable." },
        { status: 500 }
      );
    }

    const resend = new Resend(resendKey);

    const jobNumber = job?.job_number ?? "—";
    const jobName = job?.job_name ?? "—";
    const poNumber = job?.po_number ?? "—";

    const subject = `Client Concern: ${jobNumber} — ${jobName}`;

    const text = [
      `A client submitted a concern from the portal.`,
      ``,
      `From: ${user.email}`,
      `Job #: ${jobNumber}`,
      `Job Name: ${jobName}`,
      `PO #: ${poNumber}`,
      ``,
      `Message:`,
      `${message}`,
      ``,
      `— STAKD Client Portal`,
    ].join("\n");

    // NOTE:
    // - "from" must be a verified sender/domain in Resend.
    // - If you verified stakdaz.com in Resend, use something like:
    //   "STAKD Portal <no-reply@stakdaz.com>"
    const from = process.env.CONCERNS_FROM_EMAIL || "STAKD Portal <no-reply@stakdaz.com>";

    await resend.emails.send({
      from,
      to: ["joe@stakdaz.com", "pm@stakdaz.com"],
      subject,
      text,
      replyTo: user.email,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to send." },
      { status: 500 }
    );
  }
}
