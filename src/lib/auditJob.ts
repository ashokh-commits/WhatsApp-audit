import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import {
  createInstanceEvolutionClient,
  sanitizeMessages,
} from "@/lib/evolution";
import {
  extractCTWAConversations,
  matchCTWAConversations,
  computeCTWAMetrics,
} from "@/lib/ctwa";
import { scoreAudit } from "@/lib/scoring";
import {
  analyzeChatContent,
  aggregateContentAnalysis,
  computeRevenueAtRisk,
} from "@/lib/contentAnalysis";
import { windowStart } from "@/lib/utils/time";
import type { AuditMetrics } from "@/types/audit";
import type { SanitizedMessage } from "@/types/evolution";
import type { CTWAConversation } from "@/types/ctwa";
import type { ChatAnalysis } from "@/lib/contentAnalysis";
import type { Database } from "@/types/database";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type MetaAdRow = Database["public"]["Tables"]["meta_ad_rows"]["Row"];
type CTWAInsert = Database["public"]["Tables"]["ctwa_conversations"]["Insert"];
type AuditUpdate = Database["public"]["Tables"]["audits"]["Update"];

// Fetch N chats concurrently; one inter-batch delay replaces N per-chat delays.
// Keep concurrent count low enough not to flood a self-hosted Evolution instance.
const BATCH_SIZE = 6;
const INTER_BATCH_DELAY_MS = 400;

// Stop fetching chats with this many milliseconds remaining before the function
// is killed by the host. Remaining time is used for scoring + saving.
// Default 45 s is safe for Vercel Hobby (60 s limit).
// Set AUDIT_SOFT_DEADLINE_MS=260000 in env for Vercel Pro (300 s limit).
const SOFT_DEADLINE_MS = parseInt(
  process.env.AUDIT_SOFT_DEADLINE_MS ?? "45000",
  10
);

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
  windowDays: number,
  avgTicketValue: number = 0
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const startTime = Date.now();

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

    // ── 3. Fetch avg ticket value (for revenue-at-risk) ───────────────────────
    if (avgTicketValue === 0) {
      const { data: clientFull } = await admin
        .from("clients")
        .select("avg_ticket_value")
        .eq("id", clientId)
        .single() as { data: { avg_ticket_value: number } | null; error: unknown };
      if (clientFull) avgTicketValue = clientFull.avg_ticket_value ?? 0;
    }

    // ── 4. Fetch chats ────────────────────────────────────────────────────────
    await setProgress(auditId, "fetching_chats", 5);
    const sinceDate = windowStart(windowDays);
    const sinceTimestamp = Math.floor(sinceDate.getTime() / 1000);

    let allChats = await evolution.findChats(client.instance_name);
    allChats = allChats.filter((chat) => {
      const lastTs = chat.lastMessage?.messageTimestamp;
      return !lastTs || lastTs >= sinceTimestamp;
    });

    // ── 5. Fetch messages per chat (batched parallel, time-budgeted) ─────────
    const allMessages: SanitizedMessage[] = [];
    const ctwaConversations: CTWAConversation[] = [];
    const chatAnalyses: ChatAnalysis[] = [];
    const totalChats = allChats.length;
    let chatsProcessed = 0;
    let chatsFailed = 0;
    let partial = false;

    for (let batchStart = 0; batchStart < totalChats; batchStart += BATCH_SIZE) {
      // Stop fetching if we are close to the function timeout.
      // Whatever we have so far will be scored and saved as a partial report.
      if (Date.now() - startTime >= SOFT_DEADLINE_MS) {
        partial = true;
        console.warn(
          `Soft deadline reached after ${chatsProcessed}/${totalChats} chats — saving partial report.`
        );
        break;
      }

      const batch = allChats.slice(batchStart, batchStart + BATCH_SIZE);

      const settled = await Promise.allSettled(
        batch.map(async (chat) => {
          const raw = await evolution.findMessages(
            client.instance_name,
            chat.remoteJid,
            sinceTimestamp
          );
          // Content analysis runs on raw messages before text is stripped
          const analysis = analyzeChatContent(chat.remoteJid, raw);
          const sanitized = sanitizeMessages(raw);
          const ctwa = extractCTWAConversations(sanitized);
          return { analysis, sanitized, ctwa };
        })
      );

      for (const result of settled) {
        if (result.status === "fulfilled") {
          const { analysis, sanitized, ctwa } = result.value;
          chatAnalyses.push(analysis);
          allMessages.push(...sanitized);
          ctwaConversations.push(...ctwa);
        } else {
          chatsFailed++;
          console.warn("Failed to fetch chat batch entry:", result.reason);
        }
      }

      chatsProcessed += batch.length;
      const pct = 5 + Math.round((chatsProcessed / totalChats) * 65);
      await setProgress(auditId, "fetching_messages", pct, {
        chatsProcessed,
        chatsTotal: totalChats,
      });

      // Throttle between batches; skip delay after the last batch
      if (batchStart + BATCH_SIZE < totalChats) {
        await delay(INTER_BATCH_DELAY_MS);
      }
    }

    // ── 5. Compute hourly activity distribution ───────────────────────────────
    const hourlyActivity = new Array(24).fill(0) as number[];
    for (const msg of allMessages) {
      hourlyActivity[new Date(msg.timestamp * 1000).getHours()]++;
    }

    // ── 6. Aggregate content analysis ────────────────────────────────────────
    const contentAnalysis = aggregateContentAnalysis(chatAnalyses);

    // ── 7. Fetch Meta ad rows for CTWA join ───────────────────────────────────
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

    // ── 8. Score ──────────────────────────────────────────────────────────────
    const auditScore = scoreAudit(allMessages, businessProfile, ctwaMetrics, contentAnalysis);

    // ── 9. Revenue at risk ────────────────────────────────────────────────────
    const unansweredCount =
      (auditScore.dimensions.answerRate.rawMetric as { total?: number; answered?: number } | null)
        ? (auditScore.dimensions.answerRate.rawMetric as { total: number; answered: number }).total -
          (auditScore.dimensions.answerRate.rawMetric as { total: number; answered: number }).answered
        : 0;
    const revenueAtRisk =
      avgTicketValue > 0
        ? computeRevenueAtRisk(
            unansweredCount,
            contentAnalysis.engagedThenGhostedCount,
            avgTicketValue
          )
        : null;

    // ── 10. Save ───────────────────────────────────────────────────────────────
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
      chatCount: chatsProcessed,
      chatsInWindow: totalChats,
      partial: partial || undefined,
      ctwaConversationCount: matchedCTWA.length,
      coveragePct: ctwaMetrics?.coveragePct ?? 0,
      ctwaMetrics: ctwaMetrics ?? undefined,
      hourlyActivity,
      windowDays,
      windowStart: sinceDate.toISOString(),
      windowEnd: new Date().toISOString(),
      // Revenue Layer v2
      bookingIntentCount: contentAnalysis.bookingIntentCount,
      confirmedCount: contentAnalysis.confirmedCount,
      bookingIntentRate:
        contentAnalysis.inboundChats > 0
          ? contentAnalysis.bookingIntentCount / contentAnalysis.inboundChats
          : 0,
      confirmedRate:
        contentAnalysis.bookingIntentCount > 0
          ? contentAnalysis.confirmedCount / contentAnalysis.bookingIntentCount
          : 0,
      businessGhostCount: contentAnalysis.businessGhostCount,
      engagedThenGhostedCount: contentAnalysis.engagedThenGhostedCount,
      priceDropoffCount: contentAnalysis.priceDropoffCount,
      postIntentDropoffCount: contentAnalysis.postIntentDropoffCount,
      revenueAtRisk: revenueAtRisk ?? undefined,
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
