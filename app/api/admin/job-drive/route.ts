import { NextRequest, NextResponse } from "next/server";
import {
  moveJobDriveFolder,
  provisionJobDriveFolder,
  type DriveMoveTarget,
} from "@/lib/google-drive";
import { requireInternalUser } from "@/lib/supabase/server-auth";

function driveNotConfigured(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Missing GOOGLE_") || message.includes("Missing Google Drive");
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireInternalUser(req);
    if (auth.response) return auth.response;

    const body = await req.json();
    const action = String(body.action ?? "").trim();

    if (action === "provision") {
      const jobNumber = String(body.jobNumber ?? "").trim();
      const jobName = String(body.jobName ?? "").trim();

      if (!jobNumber || !jobName) {
        return NextResponse.json(
          { ok: false, error: "jobNumber and jobName are required." },
          { status: 400 }
        );
      }

      const result = await provisionJobDriveFolder(jobNumber, jobName);
      return NextResponse.json({ ok: true, action, ...result });
    }

    if (action === "move") {
      const folderUrl = String(body.folderUrl ?? "").trim();
      const target = String(body.target ?? "").trim() as DriveMoveTarget;
      const allowed: DriveMoveTarget[] = ["quoting", "current", "archived", "lost", "completed"];

      if (!folderUrl || !allowed.includes(target)) {
        return NextResponse.json(
          { ok: false, error: "folderUrl and a valid target are required." },
          { status: 400 }
        );
      }

      const result = await moveJobDriveFolder(folderUrl, target);
      return NextResponse.json({ ok: true, action, ...result });
    }

    return NextResponse.json(
      { ok: false, error: "Unknown Drive action." },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";

    if (driveNotConfigured(error)) {
      return NextResponse.json(
        { ok: false, code: "drive_not_configured", error: message },
        { status: 200 }
      );
    }

    console.error("job-drive error", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
