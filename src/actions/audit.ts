"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { applyMapping } from "@/lib/utils/parseSpreadsheet";
import type { ColumnMapping } from "@/types/ctwa";
import type { Database } from "@/types/database";

type MetaAdInsert = Database["public"]["Tables"]["meta_ad_rows"]["Insert"];

export async function uploadMetaRows(
  auditId: string,
  rawRows: Array<Record<string, string | number | null>>,
  mapping: ColumnMapping
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const parsed = applyMapping(rawRows, mapping);
  if (parsed.length === 0) return { error: "No rows to import." };

  const admin = createSupabaseAdminClient();
  const inserts: MetaAdInsert[] = parsed.map((row) => ({
    audit_id: auditId,
    campaign_name: row.campaign_name,
    adset_name:    row.adset_name,
    ad_name:       row.ad_name,
    spend:         row.spend,
    impressions:   row.impressions,
    clicks:        row.clicks,
    results:       row.results,
    source:        "csv" as const,
    raw_row:       row.raw_row as Record<string, unknown>,
  }));

  const { error } = await admin
    .from("meta_ad_rows")
    .insert(inserts) as { error: { message: string } | null };

  if (error) return { error: error.message };

  return { success: true, rowCount: inserts.length };
}

export async function getAudit(auditId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audits")
    .select(`
      id, client_id, window_days, overall_score, dimension_scores,
      metrics, status, error_message, created_at, completed_at
    `)
    .eq("id", auditId)
    .single() as {
      data: Database["public"]["Tables"]["audits"]["Row"] | null;
      error: { message: string } | null;
    };
  if (error) throw new Error(error.message);
  return data;
}

export async function getAuditCTWARows(auditId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ctwa_conversations")
    .select("*")
    .eq("audit_id", auditId) as {
      data: Database["public"]["Tables"]["ctwa_conversations"]["Row"][] | null;
      error: unknown;
    };
  return data ?? [];
}

export async function getAuditMetaRows(auditId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("meta_ad_rows")
    .select("*")
    .eq("audit_id", auditId) as {
      data: Database["public"]["Tables"]["meta_ad_rows"]["Row"][] | null;
      error: unknown;
    };
  return data ?? [];
}
