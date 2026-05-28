import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import {
  createInstanceEvolutionClient,
  sanitizeMessages,
  RATE_LIMIT_DELAY_MS,
} from "@/lib/evolution";
import {
  extractCTWAConversations,
  matchCTWAConversations,
  computeCTWAMetrics,
} from "@/lib/ctwa";
import { scoreAudit } from "@/lib/scoring";
import { windowStart } from "@/lib/utils/time";
import type { AuditMetrics } from "@/types/audit";
import type { SanitizedMessage } from "@/types/evolution";
import type { CTWAConversation } from "@/types/ctwa";
import type { Database } from "@/types/database";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type MetaAdRow = Database["public"]["Tables"]["meta_ad_rows"]["Row"];
type CTWAInsert = Database["public"]["Tables"]["ctwa_conversations"]["Insert"];
type AuditUpdate = Database["public"]["Tables"]["audits"]["Update"];

const PROGRESS_STAGES: Record<string, string> = {
  decrypting:         "Connecting to WhatsApp instance...",
  fetching_chats:     "Loading conversation list...",
  fetching_messages:  "Reading messages...",
  scoring:            "Calculating scores...",
  saving:             "Saving report...",
};

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function setProgress(
  auditId: string,
  stage: string,
  pct: number,
  extra?: Record<string, unknown>
) {
  const admin = createSupabaseAdminClient();
  await admin
    .from("audits")
    .update({
      metrics: {
        progress: { stage, pct, stageLabel: PROGRESS_STAGES[stage] ?? stage, ...extra },
      },
    } as AuditUpdate)
    .eq("id", auditId);
}

export async function runAuditJob(
  auditId: string,
  clientId: string,
  windowDays: number
): Promise<void> {
  const admin = createSupabaseAdminClient();

  try {
    await admin
      .from("audits")
      .update({ status: "running" } as AuditUpdate)
      .eq("id", auditId);

    // ── 1. Decrypt instance key ───────────────────────────────────────────────
    await setProgress(auditId, "decrypting", 2);
    const { data: client, error: cErr } = await admin
      .from("clients")
      .select("instance_name, instance_key_encrypted")
      .eq("id", clientId)
      .single() as {
        data: Pick<ClientRow, "instance_name" | "instance_key_encrypted"> | null;
        error: { message: string } | null;
      };
    if (cErr || !client) throw new Error("Client not found.");

    const instanceKey = decrypt(client.instance_key_encrypted);
    const evolution = createInstanceEvolutionClient(instanceKey);

    const connected = await evolution.verifyInstanceConnected(client.instance_name);
    if (!connected) {
      throw new Error(
        `WhatsApp instance "${client.instance_name}" is not connected. Please reconnect in your Evolution dashboard.`
      );
    }

    // ── 2. Fetch business profile ─────────────────────────────────────────────
    const businessProfile = await evolution.fetchBusinessProfile(client.instance_name);

    // ── 3. Fetch chats ────────────────────────────────────────────────────────
    await setProgress(auditId, "fetching_chats", 5);
    const sinceDate = windowStart(windowDays);
    const sinceTimestamp = Math.floor(sinceDate.getTime() / 1000);

    let allChats = await evolution.findChats(client.instance_name);
    allChats = allChats.filter((chat) => {
      const lastTs = chat.lastMessage?.messageTimestamp;
      return !lastTs || lastTs >= sinceTimestamp;
    });

    // ── 4. Fetch messages per chat ────────────────────────────────────────────
    const allMessages: SanitizedMessage[] = [];
    const ctwaConversations: CTWAConversation[] = [];
    const totalChats = allChats.length;
    let chatsProcessed = 0;
    let chatsFailed = 0;

    for (const chat of allChats) {
      try {
        const raw = await evolution.findMessages(
          client.instance_name,
          chat.remoteJid,
          sinceTimestamp
        );
        const sanitized = sanitizeMessages(raw);
        allMessages.push(...sanitized);

        const ctwa = extractCTWAConversations(sanitized);
        ctwaConversations.push(...ctwa);
      } catch (err) {
        chatsFailed++;
        console.warn(`Failed to fetch messages for ${chat.remoteJid}:`, err);
      }

      chatsProcessed++;
      const pct = 5 + Math.round((chatsProcessed / totalChats) * 65);
      if (chatsProcessed % 5 === 0 || chatsProcessed === totalChats) {
        await setProgress(auditId, "fetching_messages", pct, {
          chatsProcessed,
          chatsTotal: totalChats,
        });
      }
      await delay(RATE_LIMIT_DELAY_MS);
    }

    // ── 5. Compute hourly activity distribution ───────────────────────────────
    const hourlyActivity = new Array(24).fill(0) as number[];
    for (const msg of allMessages) {
      hourlyActivity[new Date(msg.timestamp * 1000).getHours()]++;
    }

    // ── 6. Fetch Meta ad rows for CTWA join ───────────────────────────────────
    await setProgress(auditId, "scoring", 72);
    const { data: metaRows } = await admin
      .from("meta_ad_rows")
      .select("*")
      .eq("audit_id", auditId) as {
        data: MetaAdRow[] | null;
        error: unknown;
      };

    const matchedCTWA = matchCTWAConversations(
      ctwaConversations,
      metaRows ?? []
    );
    const ctwaMetrics =
      matchedCTWA.length > 0
        ? computeCTWAMetrics(matchedCTWA, metaRows ?? [], allChats.length)
        : null;

    // ── 6. Score ──────────────────────────────────────────────────────────────
    const auditScore = scoreAudit(allMessages, businessProfile, ctwaMetrics);

    // ── 7. Save ───────────────────────────────────────────────────────────────
    await setProgress(auditId, "saving", 90);

    if (matchedCTWA.length > 0) {
      const ctwaInserts: CTWAInsert[] = matchedCTWA.map((c) => ({
        audit_id: auditId,
        chat_ref: c.chatRef,
        referral: c.referral,
        ad_headline: c.adHeadline,
        source_url: c.sourceUrl,
        answered: c.answered,
        first_response_seconds: c.firstResponseSeconds,
        matched_meta_row_id: c.matchedMetaRowId,
        match_confidence: c.matchConfidence,
      }));
      await admin.from("ctwa_conversations").insert(ctwaInserts);
    }

    const finalMetrics: AuditMetrics = {
      businessProfile: businessProfile as Record<string, unknown> | undefined,
      chatCount: allChats.length,
      ctwaConversationCount: matchedCTWA.length,
      coveragePct: ctwaMetrics?.coveragePct ?? 0,
      ctwaMetrics: ctwaMetrics ?? undefined,
      hourlyActivity,
      windowDays,
      windowStart: sinceDate.toISOString(),
      windowEnd: new Date().toISOString(),
    };

    await admin.from("audits").update({
      status: "complete",
      overall_score: auditScore.overall,
      dimension_scores: auditScore.dimensions as unknown as Record<string, unknown>,
      metrics: {
        ...finalMetrics as Record<string, unknown>,
        chatsFailed,
        progress: { stage: "complete", pct: 100, stageLabel: "Done!" },
      },
      completed_at: new Date().toISOString(),
    } as AuditUpdate).eq("id", auditId);

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await admin.from("audits").update({
      status: "failed",
      error_message: message,
    } as AuditUpdate).eq("id", auditId);
  }
}
