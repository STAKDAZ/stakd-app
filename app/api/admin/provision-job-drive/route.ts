import { NextRequest, NextResponse } from "next/server";
import { provisionJobDriveFolder } from "@/lib/google-drive";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jobNumber = String(body.jobNumber ?? "").trim();
    const jobName = String(body.jobName ?? "").trim();

    if (!jobNumber || !jobName) {
      return NextResponse.json(
        { error: "jobNumber and jobName are required" },
        { status: 400 }
      );
    }

    const result = await provisionJobDriveFolder(jobNumber, jobName);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("provision-job-drive error", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}
