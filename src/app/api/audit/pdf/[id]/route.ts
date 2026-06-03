import { getSession } from "@/lib/auth/server";
import { queryOne } from "@/lib/db";
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
  const user = await getSession();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const audit = await queryOne<AuditRow>(
    `SELECT id, client_id, window_days, overall_score, dimension_scores, metrics, status, created_at, completed_at
     FROM audits WHERE id = $1`,
    [params.id]
  );

  if (!audit) {
    notFound();
  }

  const client = await queryOne<Pick<ClientRow, "name" | "avg_ticket_value">>(
    `SELECT name, avg_ticket_value FROM clients WHERE id = $1`,
    [audit.client_id]
  );

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
