import { query, queryOne, getPool } from "@/lib/db";
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

const BATCH_SIZE = 6;
const INTER_BATCH_DELAY_MS = 400;

const SOFT_DEADLINE_MS = parseInt(
  process.env.AUDIT_SOFT_DEADLINE_MS ?? "600000",
  10
);

const PROGRESS_STAGES: Record<string, string> = {
  decrypting: "Connecting to WhatsApp instance...",
  fetching_chats: "Loading conversation list...",
  fetching_messages: "Reading messages...",
  scoring: "Calculating scores...",
  saving: "Saving report...",
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
  const progress = {
    stage,
    pct,
    stageLabel: PROGRESS_STAGES[stage] ?? stage,
    ...extra,
  };
  await query(
    `UPDATE audits SET metrics = COALESCE(metrics, '{}'::jsonb) || jsonb_build_object('progress', $1::jsonb)
     WHERE id = $2`,
    [JSON.stringify(progress), auditId]
  );
}

export async function runAuditJob(
  auditId: string,
  clientId: string,
  windowDays: number,
  avgTicketValue: number = 0
): Promise<void> {
  const startTime = Date.now();

  try {
    await query(`UPDATE audits SET status = 'running' WHERE id = $1`, [auditId]);

    await setProgress(auditId, "decrypting", 2);
    const client = await queryOne<
      Pick<ClientRow, "instance_name" | "instance_key_encrypted">
    >(
      `SELECT instance_name, instance_key_encrypted FROM clients WHERE id = $1`,
      [clientId]
    );
    if (!client) throw new Error("Client not found.");

    const instanceKey = decrypt(client.instance_key_encrypted);
    const evolution = createInstanceEvolutionClient(instanceKey);

    const connected = await evolution.verifyInstanceConnected(client.instance_name);
    if (!connected) {
      throw new Error(
        `WhatsApp instance "${client.instance_name}" is not connected. Please reconnect in your Evolution dashboard.`
      );
    }

    const businessProfile = await evolution.fetchBusinessProfile(client.instance_name);

    if (avgTicketValue === 0) {
      const ticketRow = await queryOne<{ avg_ticket_value: string }>(
        `SELECT avg_ticket_value FROM clients WHERE id = $1`,
        [clientId]
      );
      if (ticketRow) avgTicketValue = parseFloat(ticketRow.avg_ticket_value) || 0;
    }

    await setProgress(auditId, "fetching_chats", 5);
    const sinceDate = windowStart(windowDays);
    const sinceTimestamp = Math.floor(sinceDate.getTime() / 1000);

    let allChats = await evolution.findChats(client.instance_name);
    allChats = allChats.filter((chat) => {
      const lastTs = chat.lastMessage?.messageTimestamp;
      return !lastTs || lastTs >= sinceTimestamp;
    });

    const allMessages: SanitizedMessage[] = [];
    const ctwaConversations: CTWAConversation[] = [];
    const chatAnalyses: ChatAnalysis[] = [];
    const totalChats = allChats.length;
    let chatsProcessed = 0;
    let chatsFailed = 0;
    let partial = false;

    for (let batchStart = 0; batchStart < totalChats; batchStart += BATCH_SIZE) {
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
      const pct = 5 + Math.round((chatsProcessed / Math.max(totalChats, 1)) * 65);
      await setProgress(auditId, "fetching_messages", pct, {
        chatsProcessed,
        chatsTotal: totalChats,
      });

      if (batchStart + BATCH_SIZE < totalChats) {
        await delay(INTER_BATCH_DELAY_MS);
      }
    }

    const hourlyActivity = new Array(24).fill(0) as number[];
    for (const msg of allMessages) {
      hourlyActivity[new Date(msg.timestamp * 1000).getHours()]++;
    }

    const contentAnalysis = aggregateContentAnalysis(chatAnalyses);

    await setProgress(auditId, "scoring", 72);
    const metaRows = await query<MetaAdRow>(
      `SELECT * FROM meta_ad_rows WHERE audit_id = $1`,
      [auditId]
    );

    const matchedCTWA = matchCTWAConversations(ctwaConversations, metaRows);
    const ctwaMetrics =
      matchedCTWA.length > 0
        ? computeCTWAMetrics(matchedCTWA, metaRows, allChats.length)
        : null;

    const auditScore = scoreAudit(allMessages, businessProfile, ctwaMetrics, contentAnalysis);

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

    await setProgress(auditId, "saving", 90);

    if (matchedCTWA.length > 0) {
      const pool = getPool();
      const dbClient = await pool.connect();
      try {
        await dbClient.query("BEGIN");
        for (const c of matchedCTWA) {
          await dbClient.query(
            `INSERT INTO ctwa_conversations (
              audit_id, chat_ref, referral, ad_headline, source_url, answered,
              first_response_seconds, matched_meta_row_id, match_confidence
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              auditId,
              c.chatRef,
              JSON.stringify(c.referral),
              c.adHeadline,
              c.sourceUrl,
              c.answered,
              c.firstResponseSeconds,
              c.matchedMetaRowId,
              c.matchConfidence,
            ]
          );
        }
        await dbClient.query("COMMIT");
      } catch (e) {
        await dbClient.query("ROLLBACK");
        throw e;
      } finally {
        dbClient.release();
      }
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

    await query(
      `UPDATE audits SET
        status = 'complete',
        overall_score = $2,
        dimension_scores = $3::jsonb,
        metrics = $4::jsonb,
        completed_at = NOW()
       WHERE id = $1`,
      [
        auditId,
        auditScore.overall,
        JSON.stringify(auditScore.dimensions),
        JSON.stringify({
          ...finalMetrics,
          chatsFailed,
          progress: { stage: "complete", pct: 100, stageLabel: "Done!" },
        }),
      ]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await query(
      `UPDATE audits SET status = 'failed', error_message = $2 WHERE id = $1`,
      [auditId, message]
    );
  }
}
