import { NextRequest, NextResponse } from "next/server";
import { runAllBackgroundJobs } from "@/lib/engine";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Simple security check for Vercel Cron or external triggers
  if (cronSecret) {
    const expectedHeader = `Bearer ${cronSecret}`;
    const searchParams = request.nextUrl.searchParams;
    const querySecret = searchParams.get("secret");

    if (authHeader !== expectedHeader && querySecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("CRON_SECRET is not configured. Running cron job without authorization checks (only safe in local dev).");
  }

  try {
    // Run all graph and k-means computations asynchronously
    // (so the HTTP connection can close quickly, while the task completes in background)
    runAllBackgroundJobs().catch((err) => {
      console.error("Cron execution error:", err);
    });

    return NextResponse.json({
      success: true,
      message: "Background jobs triggered successfully.",
    });
  } catch (error: any) {
    console.error("Cron endpoint error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
