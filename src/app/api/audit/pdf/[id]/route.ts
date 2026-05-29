import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { renderToBuffer } from "@react-pdf/renderer";
import AuditPdfDocument from "@/components/pdf/AuditPdfDocument";
import React from "react";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type AuditRow = Database["public"]["Tables"]["audits"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

interface Params {
  params: { id: string };
}

export async function GET(_req: Request, { params }: Params) {
  const supabase = await createSupabaseServerClient();

  const { data: audit, error } = await supabase
    .from("audits")
    .select("id, client_id, window_days, overall_score, dimension_scores, metrics, status, created_at, completed_at")
    .eq("id", params.id)
    .single() as { data: AuditRow | null; error: { message: string } | null };

  if (error || !audit) {
    notFound();
  }

  const { data: client } = await supabase
    .from("clients")
    .select("name, avg_ticket_value")
    .eq("id", audit.client_id)
    .single() as {
      data: Pick<ClientRow, "name" | "avg_ticket_value"> | null;
      error: unknown;
    };

  const clientName = client?.name ?? "Client";

  const element = React.createElement(AuditPdfDocument, {
    audit: {
      id: audit.id,
      window_days: audit.window_days,
      overall_score: audit.overall_score,
      dimension_scores: audit.dimension_scores,
      metrics: audit.metrics,
      created_at: audit.created_at,
      completed_at: audit.completed_at,
    },
    clientName,
  // renderToBuffer expects ReactElement<DocumentProps> but our wrapper is compatible at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
  const buffer = await renderToBuffer(element);

  const filename = `g6-audit-${clientName.replace(/\s+/g, "-").toLowerCase()}-${audit.id.slice(0, 8)}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
