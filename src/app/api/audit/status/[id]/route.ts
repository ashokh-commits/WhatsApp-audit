import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { query, queryOne } from "@/lib/db";
import type { Database } from "@/types/database";

type AuditRow = Database["public"]["Tables"]["audits"]["Row"];

const STALE_TIMEOUT_MS = parseInt(
  process.env.AUDIT_STALE_TIMEOUT_MS ?? String(35 * 60 * 1000),
  10
);

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await queryOne<
    Pick<AuditRow, "id" | "status" | "overall_score" | "error_message" | "metrics" | "created_at">
  >(
    `SELECT id, status, overall_score, error_message, metrics, created_at
     FROM audits WHERE id = $1`,
    [params.id]
  );

  if (!data) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  if (data.status === "running" || data.status === "pending") {
    const elapsed = Date.now() - new Date(data.created_at).getTime();
    if (elapsed > STALE_TIMEOUT_MS) {
      const staleMessage =
        "Audit timed out. The WhatsApp instance may be slow to respond or the data volume is too large. Please try again.";
      await query(
        `UPDATE audits SET status = 'failed', error_message = $2 WHERE id = $1`,
        [params.id, staleMessage]
      );
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
