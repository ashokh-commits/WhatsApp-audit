import type { SanitizedMessage } from "@/types/evolution";
import type {
  CTWAConversation,
  CTWAMatchResult,
  MetaAdRow,
  CTWAMetrics,
  MatchConfidence,
} from "@/types/ctwa";
import { median } from "@/lib/utils/time";

// Inline Jaro-Winkler similarity (no external dependency)
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array<boolean>(len1).fill(false);
  const s2Matches = new Array<boolean>(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Winkler prefix bonus (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const FUZZY_THRESHOLD = 0.82;

export function extractCTWAConversations(
  messages: SanitizedMessage[]
): CTWAConversation[] {
  const chatMap = new Map<string, SanitizedMessage[]>();
  for (const msg of messages) {
    const existing = chatMap.get(msg.remoteJid) ?? [];
    existing.push(msg);
    chatMap.set(msg.remoteJid, existing);
  }

  const results: CTWAConversation[] = [];

  for (const [remoteJid, msgs] of Array.from(chatMap.entries())) {
    const sorted = (msgs as SanitizedMessage[]).sort((a, b) => a.timestamp - b.timestamp);
    const firstReferral = sorted
      .map((m) => m.referral)
      .find((r) => r !== null);

    if (!firstReferral) continue;

    const firstInbound = sorted.find((m) => !m.fromMe);
    const firstReply = firstInbound
      ? sorted.find((m) => m.fromMe && m.timestamp > firstInbound.timestamp)
      : undefined;

    const answered = firstReply !== undefined;
    const firstResponseSeconds =
      firstInbound && firstReply
        ? firstReply.timestamp - firstInbound.timestamp
        : null;

    results.push({
      chatRef: remoteJid,
      referral: firstReferral as Record<string, unknown>,
      adHeadline: (firstReferral.headline as string | null) ?? null,
      sourceUrl: (firstReferral.sourceUrl as string | null) ?? null,
      answered,
      firstResponseSeconds,
    });
  }

  return results;
}

function matchConversationToAd(
  convo: CTWAConversation,
  metaRows: MetaAdRow[]
): { metaRowId: string | null; confidence: MatchConfidence } {
  const referral = convo.referral;

  // Tier 1: Exact ID match
  const sourceId = referral.sourceId as string | undefined;
  const ctwaClid = referral.ctwaClid as string | undefined;

  if (sourceId || ctwaClid) {
    for (const row of metaRows) {
      if (row.ad_name === sourceId || row.ad_name === ctwaClid) {
        return { metaRowId: row.id, confidence: "exact" };
      }
    }
  }

  // Tier 2: Fuzzy headline match
  const headline = convo.adHeadline;
  if (headline) {
    const normHeadline = normalizeText(headline);
    let bestScore = 0;
    let bestRow: MetaAdRow | null = null;

    for (const row of metaRows) {
      const candidate = row.ad_name ?? row.campaign_name ?? "";
      if (!candidate) continue;
      const normCandidate = normalizeText(candidate);
      const sim = jaroWinkler(normHeadline, normCandidate);
      if (sim > bestScore) {
        bestScore = sim;
        bestRow = row;
      }
    }

    if (bestScore >= FUZZY_THRESHOLD && bestRow) {
      return { metaRowId: bestRow.id, confidence: "fuzzy" };
    }
  }

  // Tier 3: Campaign-level aggregate by source URL domain
  const sourceUrl = convo.sourceUrl;
  if (sourceUrl) {
    try {
      const urlDomain = new URL(sourceUrl).hostname.replace("www.", "");
      for (const row of metaRows) {
        if (
          row.campaign_name &&
          normalizeText(row.campaign_name).includes(urlDomain)
        ) {
          return { metaRowId: row.id, confidence: "campaign" };
        }
      }
    } catch {
      // Invalid URL — skip
    }
  }

  return { metaRowId: null, confidence: "unmatched" };
}

export function matchCTWAConversations(
  conversations: CTWAConversation[],
  metaRows: MetaAdRow[]
): CTWAMatchResult[] {
  return conversations.map((convo) => {
    const { metaRowId, confidence } = matchConversationToAd(convo, metaRows);
    return {
      ...convo,
      matchedMetaRowId: metaRowId,
      matchConfidence: confidence,
    };
  });
}

export function computeCTWAMetrics(
  matched: CTWAMatchResult[],
  metaRows: MetaAdRow[],
  totalConversations: number
): CTWAMetrics {
  const total = matched.length;
  const matchedToAd = matched.filter(
    (m) => m.matchConfidence === "exact" || m.matchConfidence === "fuzzy"
  ).length;
  const coveragePct = total > 0 ? matchedToAd / total : 0;

  // Compute spend from matched rows
  const matchedRowIds = new Set(
    matched
      .filter((m) => m.matchedMetaRowId)
      .map((m) => m.matchedMetaRowId)
  );
  const totalMatchedSpend = metaRows
    .filter((r) => matchedRowIds.has(r.id))
    .reduce((sum, r) => sum + (r.spend ?? 0), 0);

  const answered = matched.filter((m) => m.answered);
  const unanswered = matched.filter((m) => !m.answered);
  const answeredPaidLeadRate = total > 0 ? answered.length / total : 0;

  const costPerConversation = total > 0 ? totalMatchedSpend / total : 0;
  const costPerAnsweredConversation =
    answered.length > 0 ? totalMatchedSpend / answered.length : 0;
  const wastedSpendEstimate =
    total > 0
      ? totalMatchedSpend * (unanswered.length / total)
      : 0;

  return {
    totalCTWAConversations: total,
    matchedToAd,
    coveragePct,
    ctwaShareOfTotal: totalConversations > 0 ? total / totalConversations : 0,
    costPerConversation,
    answeredPaidLeadRate,
    wastedSpendEstimate,
    costPerAnsweredConversation,
    totalMatchedSpend,
    answeredCTWACount: answered.length,
    unansweredCTWACount: unanswered.length,
  };
}

export interface CampaignLeakageRow {
  campaignName: string;
  adName: string | null;
  spend: number;
  conversationsStarted: number;
  answered: number;
  unanswered: number;
  medianResponseSeconds: number | null;
  wastedSpend: number;
}

export function buildLeakageTable(
  matched: CTWAMatchResult[],
  metaRows: MetaAdRow[]
): CampaignLeakageRow[] {
  const rowMap = new Map(metaRows.map((r) => [r.id, r]));
  const groups = new Map<string, CTWAMatchResult[]>();

  for (const convo of matched) {
    const row = convo.matchedMetaRowId ? rowMap.get(convo.matchedMetaRowId) : null;
    const key = row?.campaign_name ?? "Unattributed";
    const existing = groups.get(key) ?? [];
    existing.push(convo);
    groups.set(key, existing);
  }

  const table: CampaignLeakageRow[] = [];

  for (const [campaignName, convos] of Array.from(groups.entries())) {
    const firstConvo = convos[0];
    const adRow = firstConvo.matchedMetaRowId
      ? rowMap.get(firstConvo.matchedMetaRowId)
      : null;
    const spend = adRow?.spend ?? 0;
    const answered = convos.filter((c) => c.answered);
    const unanswered = convos.filter((c) => !c.answered);
    const responseTimes = answered
      .map((c) => c.firstResponseSeconds)
      .filter((s): s is number => s !== null);

    table.push({
      campaignName,
      adName: adRow?.ad_name ?? null,
      spend,
      conversationsStarted: convos.length,
      answered: answered.length,
      unanswered: unanswered.length,
      medianResponseSeconds: responseTimes.length > 0 ? median(responseTimes) : null,
      wastedSpend: convos.length > 0 ? spend * (unanswered.length / convos.length) : 0,
    });
  }

  return table.sort((a, b) => b.wastedSpend - a.wastedSpend);
}
