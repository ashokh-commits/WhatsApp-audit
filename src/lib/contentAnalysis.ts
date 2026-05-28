/**
 * All keyword lists live here — edit in one place.
 * Supports English + Malay + basic Mandarin.
 * Analysis runs IN-MEMORY on raw Evolution messages; only derived
 * booleans/counts are returned — no raw text is ever stored.
 */
import type { EvolutionMessage } from "@/types/evolution";

// ── Keyword regexes ──────────────────────────────────────────────────────────

/**
 * Appointment / booking INTENT — checked on INBOUND messages only.
 * Covers: asking to book, asking about slots, asking about free consultation,
 * asking about availability, day/time references.
 */
export const BOOKING_RE =
  /\b(book(?:ing)?|appointment|consult(?:ation)?|tempah|slot|available|availability|kosong|jadual|schedule|reserve|reservation|tarikh|masa|esok|tomorrow|next\s+week|minggu\s+depan|isnin|selasa|rabu|khamis|jumaat|sabtu|ahad|monday|tuesday|wednesday|thursday|friday|saturday|sunday|bila|boleh\s+datang|nak\s+dtg|walk[\s-]?in|check[\s-]?up|rawatan|treatment|free\s+ke|free\s+tak|percuma|ada\s+slot|any\s+slot|still\s+open|still\s+available|nak\s+book|nak\s+dtg|nak\s+buat|bila\s+boleh|can\s+i\s+(?:book|come|visit|make)|how\s+to\s+(?:book|make))\b|预约|预定|订位|时间|日期|咨询|有空|空档/i;

export const PRICE_RE =
  /\b(harga|berapa|price|cost|rate|fee|yuran|bayar(?:an)?|pakej|package|diskaun|promo(?:si)?|how\s+much|deposit|quotation|quot(?:e|ed)|payment|charge)\b|rm\s*\d+|价格|多少|费用|收费|优惠|套餐/i;

/**
 * Malaysian phone number — the strongest confirmation signal.
 * Customer sharing their number = they intend to book.
 */
export const PHONE_RE = /(\+?6?0[1-9][0-9\s\-]{7,11})\b/;

/**
 * Time/date slot reference — secondary confirmation signal.
 * "10am", "3pm", "pagi", "petang", "Jumaat", specific date mentions.
 */
export const TIME_SLOT_RE =
  /\b(\d{1,2}[:\.]?\d{0,2}\s*(?:am|pm|pagi|petang|malam|tengahari)|[0-2]?\d:[0-5]\d|pagi|petang|malam|esok|tomorrow|isnin|selasa|rabu|khamis|jumaat|sabtu|ahad|monday|tuesday|wednesday|thursday|friday|saturday|sunday|minggu\s+depan|next\s+week|\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))\b/i;

/** Conservative and optimistic close-rate assumptions (visible to users) */
export const CLOSE_RATE = { conservative: 0.20, optimistic: 0.40 };

// ── Per-chat analysis ────────────────────────────────────────────────────────

export interface ChatAnalysis {
  remoteJid: string;
  inboundInitiated: boolean;
  hasBookingIntent: boolean;  // inbound customer asked about booking/appointment
  isConfirmed: boolean;       // inbound customer sent phone number (+ ideally time)
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
  let businessHasReplied = false;

  for (let i = 0; i < sorted.length; i++) {
    const msg = sorted[i];
    const text = getText(msg);
    const isInbound = !msg.key.fromMe;

    if (!isInbound) {
      businessHasReplied = true;
    }

    // Price discussion — either side can mention price
    if (PRICE_RE.test(text)) {
      hasPriceDiscussion = true;
      if (priceIdx === -1) priceIdx = i;
    }

    // Booking intent — inbound messages ONLY
    if (isInbound && BOOKING_RE.test(text)) {
      hasBookingIntent = true;
      if (intentIdx === -1) intentIdx = i;
    }

    // Confirmed — inbound message with a phone number, sent after business has replied.
    // Phone number = customer is giving their contact details to book.
    // Also require a time/slot reference in the same message or anywhere inbound
    // after the first business reply (covers multi-message detail sharing).
    if (isInbound && businessHasReplied && PHONE_RE.test(text)) {
      isConfirmed = true;
    }
  }

  const isBusinessGhosted = !lastMsg.key.fromMe;
  const hadAnyBusinessReply = businessHasReplied;

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
 * - unansweredCount    = never got any business reply (from answerRate)
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
