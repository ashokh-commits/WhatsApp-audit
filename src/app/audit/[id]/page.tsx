import { query, queryOne } from "@/lib/db";
import { notFound } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Footer from "@/components/layout/Footer";
import AuditProgressModal from "./AuditProgressModal";
import AuditReport from "./AuditReport";
import RetryAuditButton from "./RetryAuditButton";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

type AuditRow = Database["public"]["Tables"]["audits"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type CTWARow = Database["public"]["Tables"]["ctwa_conversations"]["Row"];
type MetaRow = Database["public"]["Tables"]["meta_ad_rows"]["Row"];

export default async function AuditPage({ params }: Props) {
  const audit = await queryOne<AuditRow>(
    `SELECT id, client_id, window_days, overall_score, dimension_scores,
            metrics, status, error_message, created_at, completed_at
     FROM audits WHERE id = $1`,
    [params.id]
  );

  if (!audit) notFound();

  const client = await queryOne<
    Pick<ClientRow, "name" | "instance_name" | "avg_ticket_value">
  >(
    `SELECT name, instance_name, avg_ticket_value FROM clients WHERE id = $1`,
    [audit.client_id]
  );

  const ctwaRows = await query<CTWARow>(
    `SELECT * FROM ctwa_conversations WHERE audit_id = $1`,
    [params.id]
  );

  const metaRows = await query<MetaRow>(
    `SELECT * FROM meta_ad_rows WHERE audit_id = $1`,
    [params.id]
  );

  const isRunning = audit.status === "pending" || audit.status === "running";

  return (
    <div className="flex min-h-screen md:h-screen md:overflow-hidden bg-g6-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col md:overflow-hidden">
        <TopBar title={`Audit — ${client?.name ?? "Client"}`} />
        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 pb-20 md:pb-6">
          {isRunning && (
            <AuditProgressModal
              auditId={params.id}
              initialProgress={
                (audit.metrics as Record<string, unknown> | null)?.progress as
                  | Record<string, unknown>
                  | undefined
              }
            />
          )}
          {audit.status === "failed" && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-heading text-sm font-semibold text-red-400">
                  Audit failed
                </p>
                <p className="mt-1 font-body text-sm text-gray-400">
                  {audit.error_message ?? "An unknown error occurred."}
                </p>
              </div>
              <RetryAuditButton clientId={audit.client_id} windowDays={audit.window_days} />
            </div>
          )}
          {audit.status === "complete" && (
            <AuditReport
              audit={audit}
              clientName={client?.name ?? "Client"}
              avgTicketValue={Number(client?.avg_ticket_value ?? 0)}
              ctwaRows={(ctwaRows ?? []) as Record<string, unknown>[]}
              metaRows={(metaRows ?? []) as Record<string, unknown>[]}
            />
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
}
