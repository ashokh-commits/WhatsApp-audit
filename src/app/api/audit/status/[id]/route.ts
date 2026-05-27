import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AuditRow = Database["public"]["Tables"]["audits"]["Row"];

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
    .select("id, status, overall_score, error_message, metrics")
    .eq("id", params.id)
    .single() as {
      data: Pick<AuditRow, "id" | "status" | "overall_score" | "error_message" | "metrics"> | null;
      error: { message: string } | null;
    };

  if (error || !data) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
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
