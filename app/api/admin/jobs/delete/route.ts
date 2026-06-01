import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { trashJobDriveFolder } from "@/lib/google-drive";
import { requireInternalUser } from "@/lib/supabase/server-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function driveNotConfigured(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Missing GOOGLE_") || message.includes("Missing Google Drive");
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL." }, { status: 500 });
    }
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
    }

    const auth = await requireInternalUser(req);
    if (auth.response) return auth.response;

    const body = await req.json();
    const id = String(body?.id ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "Job id is required." }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: job, error: getError } = await adminClient
      .from("jobs")
      .select("id, job_number, job_name, job_folder_url")
      .eq("id", id)
      .maybeSingle();

    if (getError) {
      return NextResponse.json({ error: getError.message }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const { error: deleteError } = await adminClient.from("jobs").delete().eq("id", id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    let driveWarning: string | null = null;
    if (job.job_folder_url) {
      try {
        await trashJobDriveFolder(job.job_folder_url);
      } catch (error) {
        driveWarning = driveNotConfigured(error)
          ? "Job deleted. Google Drive folder was not removed because Drive is not fully connected."
          : error instanceof Error
          ? `Job deleted. Google Drive folder could not be trashed: ${error.message}`
          : "Job deleted. Google Drive folder could not be trashed.";
      }
    }

    return NextResponse.json({
      ok: true,
      deleted: {
        id: job.id,
        job_number: job.job_number,
        job_name: job.job_name,
      },
      warning: driveWarning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    console.error("delete job error", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
