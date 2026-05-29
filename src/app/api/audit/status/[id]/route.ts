import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AuditRow = Database["public"]["Tables"]["audits"]["Row"];

const STALE_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("audits")
    .select("id, status, overall_score, error_message, metrics, created_at")
    .eq("id", params.id)
    .single() as {
      data: Pick<AuditRow, "id" | "status" | "overall_score" | "error_message" | "metrics" | "created_at"> | null;
      error: { message: string } | null;
    };

  if (error || !data) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  // Auto-fail audits that have been running/pending longer than the timeout window.
  // This handles the case where the Vercel function was killed before it could
  // update the status to "failed".
  if (data.status === "running" || data.status === "pending") {
    const elapsed = Date.now() - new Date(data.created_at).getTime();
    if (elapsed > STALE_TIMEOUT_MS) {
      const admin = createSupabaseAdminClient();
      const staleMessage = "Audit timed out. The WhatsApp instance may be slow to respond or the data volume is too large. Please try again.";
      await admin
        .from("audits")
        .update({ status: "failed", error_message: staleMessage } as Database["public"]["Tables"]["audits"]["Update"])
        .eq("id", params.id);
      return NextResponse.json({
        status: "failed",
        overallScore: null,
        errorMessage: staleMessage,
        progress: { stage: "failed", pct: 0, stageLabel: "Timed out" },
      });
    }
  }

  const metrics = data.metrics as Record<string, unknown> | null;
  const progress = metrics?.progress as Record<string, unknown> | undefined;

  return NextResponse.json({
    status: data.status,
    overallScore: data.overall_score,
    errorMessage: data.error_message,
    progress: progress ?? { stage: "pending", pct: 0, stageLabel: "Waiting to start..." },
  });
}
