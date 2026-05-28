/**
 * All keyword lists live here — edit in one place.
 * Supports English + Malay + basic Mandarin.
 * Analysis runs IN-MEMORY on raw Evolution messages; only derived
 * booleans/counts are returned — no raw text is ever stored.
 */
import type { EvolutionMessage } from "@/types/evolution";

// ── Keyword regexes ──────────────────────────────────────────────────────────

export const BOOKING_RE =
  /\b(book(?:ing)?|appointment|tempah|slot|available|availability|kosong|jadual|schedule|confirm(?:ed)?|reserve|reservation|tarikh|masa|esok|tomorrow|next\s+week|minggu\s+depan|isnin|selasa|rabu|khamis|jumaat|sabtu|ahad|monday|tuesday|wednesday|thursday|friday|saturday|sunday|bila|boleh\s+datang|nak\s+dtg)\b|预约|预定|订位|确认|时间|日期/i;

export const PRICE_RE =
  /\b(harga|berapa|price|cost|rate|fee|yuran|bayar(?:an)?|pakej|package|diskaun|promo(?:si)?|how\s+much|deposit|quotation|quot(?:e|ed)|payment|charge)\b|rm\s*\d+|价格|多少|费用|收费|优惠|套餐/i;

export const CONFIRMATION_RE =
  /\b(confirm(?:ed)?|booked?|see\s+you|see\s+u|noted|alright|all\s+good|done|dah\s+confirm|dah\s+book|okay|ok\b|baik|jumpa|selesai|beres|boleh|great|perfect|wonderful|terima\s+kasih|thanks?)\b|确认了|已预约|好的/i;

/** Conservative and optimistic close-rate assumptions (visible to users) */
export const CLOSE_RATE = { conservative: 0.20, optimistic: 0.40 };

// ── Per-chat analysis ────────────────────────────────────────────────────────

export interface ChatAnalysis {
  remoteJid: string;
  inboundInitiated: boolean;
  hasBookingIntent: boolean;
  isConfirmed: boolean;
  hasPriceDiscussion: boolean;
  isBusinessGhosted: boolean;
  hadAnyBusinessReply: boolean;
  dropoffStage: "greeting" | "post-price" | "post-intent" | "other";
}

function getText(msg: EvolutionMessage): string {
  return (
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text ??
    (msg.message?.imageMessage?.caption as string | undefined) ??
    ""
  ).toLowerCase();
}

export function analyzeChatContent(
  remoteJid: string,
  messages: EvolutionMessage[]
): ChatAnalysis {
  if (messages.length === 0) {
    return {
      remoteJid,
      inboundInitiated: false,
      hasBookingIntent: false,
      isConfirmed: false,
      hasPriceDiscussion: false,
      isBusinessGhosted: false,
      hadAnyBusinessReply: false,
      dropoffStage: "other",
    };
  }

  const sorted = [...messages].sort(
    (a, b) => a.messageTimestamp - b.messageTimestamp
  );
  const firstMsg = sorted[0];
  const lastMsg = sorted[sorted.length - 1];
  const inboundInitiated = !firstMsg.key.fromMe;

  let hasBookingIntent = false;
  let isConfirmed = false;
  let hasPriceDiscussion = false;
  let priceIdx = -1;
  let intentIdx = -1;

  for (let i = 0; i < sorted.length; i++) {
    const text = getText(sorted[i]);
    if (PRICE_RE.test(text) && priceIdx === -1) priceIdx = i;
    if (BOOKING_RE.test(text) && intentIdx === -1) intentIdx = i;
    if (PRICE_RE.test(text)) hasPriceDiscussion = true;
    if (BOOKING_RE.test(text)) hasBookingIntent = true;
    if (sorted[i].key.fromMe && CONFIRMATION_RE.test(text)) isConfirmed = true;
  }

  const isBusinessGhosted = !lastMsg.key.fromMe;
  const hadAnyBusinessReply = sorted.some((m) => m.key.fromMe);

  // Drop-off stage (relevant only when business ghosted)
  let dropoffStage: ChatAnalysis["dropoffStage"] = "other";
  if (isBusinessGhosted) {
    const lastInboundIdx = sorted.reduceRight(
      (acc, m, i) => (acc === -1 && !m.key.fromMe ? i : acc),
      -1
    );
    if (hasBookingIntent && intentIdx !== -1 && lastInboundIdx >= intentIdx) {
      dropoffStage = "post-intent";
    } else if (hasPriceDiscussion && priceIdx !== -1 && lastInboundIdx >= priceIdx) {
      dropoffStage = "post-price";
    } else if (!hasPriceDiscussion && !hasBookingIntent) {
      dropoffStage = "greeting";
    }
  }

  return {
    remoteJid,
    inboundInitiated,
    hasBookingIntent,
    isConfirmed,
    hasPriceDiscussion,
    isBusinessGhosted,
    hadAnyBusinessReply,
    dropoffStage,
  };
}

// ── Aggregate across all chats ───────────────────────────────────────────────

export interface AggregatedContentAnalysis {
  totalChats: number;
  inboundChats: number;
  bookingIntentCount: number;
  confirmedCount: number;
  businessGhostCount: number;
  engagedThenGhostedCount: number; // had a reply then business went silent
  priceDropoffCount: number;
  postIntentDropoffCount: number;
  dropoffByStage: {
    greeting: number;
    "post-price": number;
    "post-intent": number;
    other: number;
  };
}

export function aggregateContentAnalysis(
  analyses: ChatAnalysis[]
): AggregatedContentAnalysis {
  const inbound = analyses.filter((a) => a.inboundInitiated);
  const ghosted = inbound.filter((a) => a.isBusinessGhosted);

  return {
    totalChats: analyses.length,
    inboundChats: inbound.length,
    bookingIntentCount: inbound.filter((a) => a.hasBookingIntent).length,
    confirmedCount: inbound.filter((a) => a.isConfirmed).length,
    businessGhostCount: ghosted.length,
    engagedThenGhostedCount: ghosted.filter((a) => a.hadAnyBusinessReply).length,
    priceDropoffCount: ghosted.filter((a) => a.dropoffStage === "post-price").length,
    postIntentDropoffCount: ghosted.filter((a) => a.dropoffStage === "post-intent").length,
    dropoffByStage: {
      greeting: ghosted.filter((a) => a.dropoffStage === "greeting").length,
      "post-price": ghosted.filter((a) => a.dropoffStage === "post-price").length,
      "post-intent": ghosted.filter((a) => a.dropoffStage === "post-intent").length,
      other: ghosted.filter((a) => a.dropoffStage === "other").length,
    },
  };
}

// ── Revenue at risk ──────────────────────────────────────────────────────────

export interface RevenueAtRisk {
  lostLeadPool: number;
  low: number;
  high: number;
  avgTicketValue: number;
  math: string;
}

/**
 * De-duped lost-lead pool:
 * - unansweredCount   = never got any business reply (from answerRate)
 * - engagedThenGhosted = had a reply but business went silent (not in above)
 * These two sets are mutually exclusive so no double-counting.
 */
export function computeRevenueAtRisk(
  unansweredCount: number,
  engagedThenGhostedCount: number,
  avgTicketValue: number
): RevenueAtRisk {
  const lostLeadPool = unansweredCount + engagedThenGhostedCount;
  const low = Math.round(lostLeadPool * avgTicketValue * CLOSE_RATE.conservative);
  const high = Math.round(lostLeadPool * avgTicketValue * CLOSE_RATE.optimistic);
  return {
    lostLeadPool,
    low,
    high,
    avgTicketValue,
    math: `${lostLeadPool} uncaptured leads × RM${avgTicketValue} × ${(CLOSE_RATE.conservative * 100).toFixed(0)}–${(CLOSE_RATE.optimistic * 100).toFixed(0)}% assumed close rate`,
  };
}
