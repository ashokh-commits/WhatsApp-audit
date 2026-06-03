"use server";

import { getSession } from "@/lib/auth/server";
import { query, queryOne } from "@/lib/db";
import { applyMapping } from "@/lib/utils/parseSpreadsheet";
import type { ColumnMapping } from "@/types/ctwa";
import type { Database } from "@/types/database";

type MetaAdRow = Database["public"]["Tables"]["meta_ad_rows"]["Row"];
type AuditRow = Database["public"]["Tables"]["audits"]["Row"];
type CtwaRow = Database["public"]["Tables"]["ctwa_conversations"]["Row"];

export async function uploadMetaRows(
  auditId: string,
  rawRows: Array<Record<string, string | number | null>>,
  mapping: ColumnMapping
) {
  const user = await getSession();
  if (!user) return { error: "Unauthorized." };

  const parsed = applyMapping(rawRows, mapping);
  if (parsed.length === 0) return { error: "No rows to import." };

  const pool = (await import("@/lib/db")).getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of parsed) {
      await client.query(
        `INSERT INTO meta_ad_rows (
          audit_id, campaign_name, adset_name, ad_name, spend, impressions, clicks, results, source, raw_row
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'csv',$9)`,
        [
          auditId,
          row.campaign_name,
          row.adset_name,
          row.ad_name,
          row.spend,
          row.impressions,
          row.clicks,
          row.results,
          JSON.stringify(row.raw_row),
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Import failed.";
    return { error: message };
  } finally {
    client.release();
  }

  return { success: true, rowCount: parsed.length };
}

export async function getAudit(auditId: string) {
  const audit = await queryOne<AuditRow>(
    `SELECT id, client_id, window_days, overall_score, dimension_scores,
            metrics, status, error_message, created_at, completed_at
     FROM audits WHERE id = $1`,
    [auditId]
  );
  if (!audit) throw new Error("Audit not found");
  return audit;
}

export async function getAuditCTWARows(auditId: string) {
  return query<CtwaRow>(`SELECT * FROM ctwa_conversations WHERE audit_id = $1`, [auditId]);
}

export async function getAuditMetaRows(auditId: string) {
  return query<MetaAdRow>(`SELECT * FROM meta_ad_rows WHERE audit_id = $1`, [auditId]);
}
