import type { SanitizedMessage } from "@/types/evolution";
import type { EvolutionBusinessProfile } from "@/types/evolution";
import type {
  DimensionResult,
  AuditDimensionScores,
  AuditScore,
  DimensionStatus,
} from "@/types/scoring";
import type { CTWAMetrics } from "@/types/ctwa";
import { DIMENSION_WEIGHTS } from "@/types/scoring";
import { median, isAfterHours } from "@/lib/utils/time";

const COMPLIANCE_KEYWORDS =
  /\b(opt[\s-]?in|consent|unsubscribe|stop|privacy|terms|pdpa|gdpr|agree)\b/i;

function status(score: number, goodThreshold = 75, warnThreshold = 50): DimensionStatus {
  if (score >= goodThreshold) return "good";
  if (score >= warnThreshold) return "warning";
  return "critical";
}

interface ChatMessages {
  remoteJid: string;
  messages: SanitizedMessage[];
}

function groupByChat(messages: SanitizedMessage[]): ChatMessages[] {
  const map = new Map<string, SanitizedMessage[]>();
  for (const msg of messages) {
    const existing = map.get(msg.remoteJid) ?? [];
    existing.push(msg);
    map.set(msg.remoteJid, existing);
  }
  return Array.from(map.entries()).map(([remoteJid, msgs]) => ({
    remoteJid,
    messages: msgs.sort((a, b) => a.timestamp - b.timestamp),
  }));
}

function isInboundInitiated(chat: ChatMessages): boolean {
  const first = chat.messages[0];
  return first ? !first.fromMe : false;
}

const SLOW_REPLY_THRESHOLD_S = 30 * 60; // 30 minutes

export function computeResponseSpeed(messages: SanitizedMessage[]): DimensionResult {
  const chats = groupByChat(messages).filter(isInboundInitiated);

  if (chats.length === 0) {
    return {
      score: 50,
      rawMetric: { medianResponseSeconds: null, pctUnder1h: null, chats: 0 },
      status: "warning",
      businessImpact: "No inbound conversations found to measure response speed.",
    };
  }

  const firstResponseDeltas: number[] = [];
  let afterHoursSlowCount = 0;
  let slowReplyCount = 0;
  let totalReplies = 0;

  for (const chat of chats) {
    const inboundMsgs = chat.messages.filter((m) => !m.fromMe);

    // First-response delta
    const firstInbound = inboundMsgs[0];
    if (firstInbound) {
      const firstReply = chat.messages.find(
        (m) => m.fromMe && m.timestamp > firstInbound.timestamp
      );
      if (firstReply) {
        const delta = firstReply.timestamp - firstInbound.timestamp;
        firstResponseDeltas.push(delta);
        if (isAfterHours(firstInbound.timestamp) && delta > 8 * 3600) {
          afterHoursSlowCount++;
        }
      }
    }

    // All reply times — flag any > 30 min
    for (const inbound of inboundMsgs) {
      const reply = chat.messages.find(
        (m) => m.fromMe && m.timestamp > inbound.timestamp
      );
      if (reply) {
        totalReplies++;
        if (reply.timestamp - inbound.timestamp > SLOW_REPLY_THRESHOLD_S) {
          slowReplyCount++;
        }
      }
    }
  }

  if (firstResponseDeltas.length === 0) {
    return {
      score: 0,
      rawMetric: { medianResponseSeconds: null, pctUnder1h: 0, chats: chats.length },
      status: "critical",
      businessImpact: `None of the ${chats.length} inbound leads received a reply.`,
    };
  }

  const med = median(firstResponseDeltas);
  const pctUnder1h =
    (firstResponseDeltas.filter((d) => d <= 3600).length / firstResponseDeltas.length) * 100;

  let score: number;
  if (med <= 300) score = 100;
  else if (med <= 3600) score = 70;
  else if (med <= 14400) score = 40;
  else score = 0;

  // After-hours first-response penalty (up to -15)
  const afterHoursPenalty = Math.min(
    15,
    Math.round((afterHoursSlowCount / chats.length) * 15)
  );
  score = Math.max(0, score - afterHoursPenalty);

  // Overall slow-reply penalty — each % of replies > 30 min costs up to -20 pts
  const slowReplyRate = totalReplies > 0 ? slowReplyCount / totalReplies : 0;
  const slowReplyPenalty = Math.round(slowReplyRate * 20);
  score = Math.max(0, score - slowReplyPenalty);

  const medMins = Math.round(med / 60);
  const slowPct = totalReplies > 0 ? ((slowReplyCount / totalReplies) * 100).toFixed(0) : "0";

  const businessImpact =
    med <= 300 && slowReplyCount === 0
      ? `Excellent — median first reply ${medMins}m. All replies within 30 minutes.`
      : med <= 300
      ? `Median first reply ${medMins}m, but ${slowPct}% of all replies took over 30 minutes.`
      : med <= 3600
      ? `Median first reply ${medMins}m. ${slowPct}% of replies exceeded the 30-minute threshold.`
      : `Median first reply ${(med / 3600).toFixed(1)}h — leads may drop off. ${slowPct}% of replies over 30 minutes.`;

  return {
    score,
    rawMetric: {
      medianResponseSeconds: med,
      pctUnder1h,
      chats: chats.length,
      slowReplyCount,
      totalReplies,
      slowReplyRate,
    },
    status: status(score, 70, 40),
    businessImpact,
  };
}

export function computeAnswerRate(messages: SanitizedMessage[]): DimensionResult {
  const chats = groupByChat(messages).filter(isInboundInitiated);

  if (chats.length === 0) {
    return {
      score: 50,
      rawMetric: { answered: 0, total: 0, rate: null },
      status: "warning",
      businessImpact: "No inbound conversations to measure answer rate.",
    };
  }

  const answeredChats = chats.filter((chat) =>
    chat.messages.some(
      (m) =>
        m.fromMe &&
        m.timestamp > (chat.messages.find((x) => !x.fromMe)?.timestamp ?? 0)
    )
  );

  const rate = (answeredChats.length / chats.length) * 100;
  const unanswered = chats.length - answeredChats.length;
  const score = Math.round(rate);

  const businessImpact =
    rate >= 80
      ? `${rate.toFixed(0)}% of inbound leads received a reply — strong coverage.`
      : rate >= 60
      ? `${unanswered} of ${chats.length} inbound leads went unanswered — these are lost opportunities.`
      : `${unanswered} of ${chats.length} leads (${(100 - rate).toFixed(0)}%) went unanswered — these are lost consultations.`;

  return {
    score,
    rawMetric: { answered: answeredChats.length, total: chats.length, rate },
    status: status(score, 80, 60),
    businessImpact,
  };
}

export function computeConversationCompletion(messages: SanitizedMessage[]): DimensionResult {
  const chats = groupByChat(messages).filter(isInboundInitiated);
  const answeredChats = chats.filter((chat) =>
    chat.messages.some((m) => m.fromMe)
  );

  if (answeredChats.length === 0) {
    return {
      score: 0,
      rawMetric: { completedChats: 0, answeredChats: 0 },
      status: "critical",
      businessImpact: "No answered conversations to measure completion rate.",
    };
  }

  const completedChats = answeredChats.filter(
    (chat) => chat.messages.filter((m) => m.fromMe).length > 1
  );
  const rate = (completedChats.length / answeredChats.length) * 100;
  const score = Math.round(rate);

  return {
    score,
    rawMetric: { completedChats: completedChats.length, answeredChats: answeredChats.length, rate },
    status: status(score, 70, 40),
    businessImpact:
      rate >= 70
        ? `${rate.toFixed(0)}% of conversations progressed beyond a single reply — good engagement depth.`
        : `Only ${rate.toFixed(0)}% of conversations went beyond a single reply — conversations may be dropping off too early.`,
  };
}

export function computeAutomation(messages: SanitizedMessage[]): DimensionResult {
  const chats = groupByChat(messages).filter(isInboundInitiated);

  if (chats.length === 0) {
    return {
      score: 50,
      rawMetric: { automatedChats: 0, total: 0 },
      status: "warning",
      businessImpact: "No inbound conversations to detect automation.",
    };
  }

  let automatedCount = 0;
  const textCounts = new Map<string, number>();

  for (const chat of chats) {
    const firstInbound = chat.messages.find((m) => !m.fromMe);
    if (!firstInbound) continue;
    const firstReply = chat.messages.find(
      (m) => m.fromMe && m.timestamp > firstInbound.timestamp
    );
    if (!firstReply) continue;
    const delta = firstReply.timestamp - firstInbound.timestamp;
    if (delta <= 5) {
      automatedCount++;
      if (firstReply.textSnippet) {
        const key = firstReply.textSnippet.trim().toLowerCase();
        textCounts.set(key, (textCounts.get(key) ?? 0) + 1);
      }
    }
  }

  // Also count chats matching identical greetings in 3+ chats (if STORE_RAW=true)
  const repeatedTextMatches = Array.from(textCounts.values()).filter((c) => c >= 3).length;
  const automationScore = Math.min(
    100,
    Math.round((automatedCount / chats.length) * 100)
  );

  return {
    score: automationScore,
    rawMetric: {
      automatedChats: automatedCount,
      total: chats.length,
      rate: automationScore,
      repeatedGreetingPatterns: repeatedTextMatches,
    },
    status: automationScore >= 40 ? "good" : automationScore >= 10 ? "warning" : "critical",
    businessImpact:
      automationScore >= 40
        ? `${automationScore}% of conversations have automated first replies — good use of automation to handle volume.`
        : automationScore >= 10
        ? `Only ${automationScore}% of chats show automated responses — consider adding a greeting/away message to improve speed.`
        : `No significant automation detected. Every conversation requires manual first response — not scalable.`,
  };
}

export function computeProfileCompleteness(
  profile: EvolutionBusinessProfile | null
): DimensionResult {
  if (!profile) {
    return {
      score: 0,
      rawMetric: { filled: 0, total: 6 },
      status: "critical",
      businessImpact: "Business profile could not be retrieved.",
    };
  }

  const fields: Array<{ key: keyof EvolutionBusinessProfile; label: string }> = [
    { key: "description",       label: "Description" },
    { key: "email",             label: "Email" },
    { key: "websites",          label: "Website" },
    { key: "address",           label: "Address" },
    { key: "category",          label: "Category" },
    { key: "profilePictureUrl", label: "Profile Picture" },
  ];

  const missing: string[] = [];
  let filled = 0;

  for (const { key, label } of fields) {
    const val = profile[key];
    if (val && (typeof val !== "string" || val.trim().length > 0) && (!Array.isArray(val) || val.length > 0)) {
      filled++;
    } else {
      missing.push(label);
    }
  }

  const score = Math.round((filled / fields.length) * 100);
  return {
    score,
    rawMetric: { filled, total: fields.length, missing },
    status: status(score, 80, 50),
    businessImpact:
      missing.length === 0
        ? "Business profile is fully complete — customers can find all contact and business details."
        : `Missing: ${missing.join(", ")}. Incomplete profiles lose trust and reduce discoverability.`,
  };
}

export function computePaidPerformance(ctwaMetrics: CTWAMetrics | null): DimensionResult {
  if (!ctwaMetrics || ctwaMetrics.totalCTWAConversations === 0) {
    return {
      score: 50,
      rawMetric: null,
      status: "warning",
      businessImpact: "No Meta ad data provided. Upload a Meta Ads CSV to score paid performance.",
    };
  }

  const { answeredPaidLeadRate, wastedSpendEstimate, totalMatchedSpend, coveragePct } = ctwaMetrics;

  // Score based on answered paid lead rate
  let score = Math.round(answeredPaidLeadRate * 100);
  // Penalise low coverage (uncertain data)
  if (coveragePct < 0.5) score = Math.round(score * 0.8);

  const wastedRm = wastedSpendEstimate.toFixed(2);
  const businessImpact =
    answeredPaidLeadRate >= 0.9
      ? `Excellent paid lead response — ${(answeredPaidLeadRate * 100).toFixed(0)}% of ad-driven conversations received a reply.`
      : `RM ${wastedRm} of ad spend started conversations that went unanswered — ${((1 - answeredPaidLeadRate) * 100).toFixed(0)}% paid leads got no reply.`;

  return {
    score: Math.min(100, Math.max(0, score)),
    rawMetric: { ...ctwaMetrics, totalMatchedSpend },
    status: status(score, 80, 60),
    businessImpact,
  };
}

export function computeComplianceHygiene(messages: SanitizedMessage[]): DimensionResult {
  const chats = groupByChat(messages);

  if (chats.length === 0) {
    return {
      score: 0,
      rawMetric: { chatsWithConsent: 0, total: 0 },
      status: "critical",
      businessImpact: "No conversations to evaluate compliance.",
    };
  }

  let chatsWithConsent = 0;

  for (const chat of chats) {
    const firstTwo = chat.messages
      .filter((m) => m.fromMe)
      .slice(0, 2);
    const hasConsent = firstTwo.some(
      (m) => m.textSnippet && COMPLIANCE_KEYWORDS.test(m.textSnippet)
    );
    if (hasConsent) chatsWithConsent++;
  }

  const rate = (chatsWithConsent / chats.length) * 100;
  const score = Math.round(rate);

  return {
    score,
    rawMetric: { chatsWithConsent, total: chats.length, rate },
    status: status(score, 60, 20),
    businessImpact:
      score >= 60
        ? `${score}% of conversations include consent/opt-in language in early messages — good PDPA hygiene.`
        : score >= 20
        ? `Only ${score}% of conversations include consent language. Review opening messages for PDPA 2010 compliance.`
        : `Consent/opt-in language is largely absent from conversations — significant PDPA exposure for clinic/medispa clients.`,
  };
}

export function computeOverallScore(dimensions: AuditDimensionScores): number {
  let total = 0;
  for (const [key, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    const dim = dimensions[key as keyof AuditDimensionScores];
    total += dim.score * weight;
  }
  return Math.round(total);
}

export function scoreAudit(
  messages: SanitizedMessage[],
  businessProfile: EvolutionBusinessProfile | null,
  ctwaMetrics: CTWAMetrics | null
): AuditScore {
  const dimensions: AuditDimensionScores = {
    responseSpeed:          computeResponseSpeed(messages),
    answerRate:             computeAnswerRate(messages),
    conversationCompletion: computeConversationCompletion(messages),
    automation:             computeAutomation(messages),
    profileCompleteness:    computeProfileCompleteness(businessProfile),
    paidPerformance:        computePaidPerformance(ctwaMetrics),
    complianceHygiene:      computeComplianceHygiene(messages),
  };

  return {
    overall: computeOverallScore(dimensions),
    dimensions,
  };
}
