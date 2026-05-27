import {
  computeResponseSpeed,
  computeAnswerRate,
  computeConversationCompletion,
  computeAutomation,
  computeProfileCompleteness,
  computeComplianceHygiene,
  computeOverallScore,
  scoreAudit,
} from "@/lib/scoring";
import type { SanitizedMessage } from "@/types/evolution";

function makeMsg(
  remoteJid: string,
  fromMe: boolean,
  timestamp: number,
  textSnippet?: string
): SanitizedMessage {
  return {
    id: `${remoteJid}-${timestamp}`,
    remoteJid,
    fromMe,
    timestamp,
    messageType: "conversation",
    referral: null,
    hasMedia: false,
    textSnippet,
  };
}

describe("computeResponseSpeed", () => {
  test("returns warning with no messages", () => {
    const result = computeResponseSpeed([]);
    expect(result.score).toBe(50);
    expect(result.status).toBe("warning");
  });

  test("scores 100 for <5m median response", () => {
    const msgs = [
      makeMsg("chat1", false, 1000),
      makeMsg("chat1", true,  1200), // 200s
      makeMsg("chat2", false, 2000),
      makeMsg("chat2", true,  2250), // 250s
    ];
    const result = computeResponseSpeed(msgs);
    expect(result.score).toBe(100);
    expect(result.status).toBe("good");
  });

  test("scores 0 for >4h median response", () => {
    const msgs = [
      makeMsg("chat1", false, 1000),
      makeMsg("chat1", true,  1000 + 5 * 3600), // 5h
    ];
    const result = computeResponseSpeed(msgs);
    expect(result.score).toBe(0);
  });

  test("critical if no replies at all", () => {
    const msgs = [
      makeMsg("chat1", false, 1000),
      makeMsg("chat2", false, 2000),
    ];
    const result = computeResponseSpeed(msgs);
    expect(result.status).toBe("critical");
    expect(result.score).toBe(0);
  });
});

describe("computeAnswerRate", () => {
  test("returns 100 when all chats answered", () => {
    const msgs = [
      makeMsg("chat1", false, 1000),
      makeMsg("chat1", true,  2000),
      makeMsg("chat2", false, 3000),
      makeMsg("chat2", true,  4000),
    ];
    expect(computeAnswerRate(msgs).score).toBe(100);
    expect(computeAnswerRate(msgs).status).toBe("good");
  });

  test("returns 0 when no chats answered", () => {
    const msgs = [
      makeMsg("chat1", false, 1000),
      makeMsg("chat2", false, 2000),
    ];
    const result = computeAnswerRate(msgs);
    expect(result.score).toBe(0);
    expect(result.status).toBe("critical");
  });

  test("returns 50 for 50% answer rate", () => {
    const msgs = [
      makeMsg("chat1", false, 1000),
      makeMsg("chat1", true,  2000),
      makeMsg("chat2", false, 3000),
    ];
    const result = computeAnswerRate(msgs);
    expect(result.score).toBe(50);
    // 50% is below the 60% warning threshold, so critical
    expect(result.status).toBe("critical");
  });
});

describe("computeConversationCompletion", () => {
  test("returns 100 when all answered chats have >1 reply", () => {
    const msgs = [
      makeMsg("chat1", false, 1000),
      makeMsg("chat1", true,  2000),
      makeMsg("chat1", true,  3000),
    ];
    expect(computeConversationCompletion(msgs).score).toBe(100);
  });

  test("returns 0 when answered chats have only 1 reply each", () => {
    const msgs = [
      makeMsg("chat1", false, 1000),
      makeMsg("chat1", true,  2000),
      makeMsg("chat2", false, 3000),
      makeMsg("chat2", true,  4000),
    ];
    expect(computeConversationCompletion(msgs).score).toBe(0);
  });
});

describe("computeProfileCompleteness", () => {
  test("scores 100 for fully complete profile", () => {
    const result = computeProfileCompleteness({
      description: "Top clinic",
      email: "clinic@example.com",
      websites: ["https://example.com"],
      address: "123 Main St",
      category: "Health",
      profilePictureUrl: "https://pic.com/photo.jpg",
    });
    expect(result.score).toBe(100);
    expect(result.status).toBe("good");
  });

  test("scores 0 for null profile", () => {
    const result = computeProfileCompleteness(null);
    expect(result.score).toBe(0);
    expect(result.status).toBe("critical");
  });

  test("partial profile gives partial score", () => {
    const result = computeProfileCompleteness({
      description: "Top clinic",
      email: "a@b.com",
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });
});

describe("computeComplianceHygiene", () => {
  test("detects consent keyword in first fromMe message", () => {
    const msgs = [
      makeMsg("chat1", false, 1000),
      makeMsg("chat1", true,  2000, "Please opt-in to receive updates from us."),
    ];
    const result = computeComplianceHygiene(msgs);
    expect(result.score).toBe(100);
  });

  test("returns 0 for no consent keywords", () => {
    const msgs = [
      makeMsg("chat1", false, 1000),
      makeMsg("chat1", true,  2000, "Hello! How can we help you today?"),
    ];
    const result = computeComplianceHygiene(msgs);
    expect(result.score).toBe(0);
  });
});

describe("computeOverallScore", () => {
  test("computes weighted average correctly", () => {
    const dims = {
      responseSpeed:          { score: 100, rawMetric: null, status: "good" as const, businessImpact: "" },
      answerRate:             { score: 80,  rawMetric: null, status: "good" as const, businessImpact: "" },
      conversationCompletion: { score: 60,  rawMetric: null, status: "warning" as const, businessImpact: "" },
      automation:             { score: 40,  rawMetric: null, status: "warning" as const, businessImpact: "" },
      profileCompleteness:    { score: 70,  rawMetric: null, status: "warning" as const, businessImpact: "" },
      paidPerformance:        { score: 50,  rawMetric: null, status: "warning" as const, businessImpact: "" },
      complianceHygiene:      { score: 30,  rawMetric: null, status: "critical" as const, businessImpact: "" },
    };
    // 100*0.30 + 80*0.20 + 60*0.10 + 40*0.10 + 70*0.10 + 50*0.10 + 30*0.10
    // = 30 + 16 + 6 + 4 + 7 + 5 + 3 = 71
    expect(computeOverallScore(dims)).toBe(71);
  });
});

describe("scoreAudit", () => {
  test("returns AuditScore with all dimensions and valid overall", () => {
    const msgs = [
      makeMsg("chat1", false, 1000),
      makeMsg("chat1", true,  1200, "consent acknowledged"),
    ];
    const result = scoreAudit(msgs, null, null);
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    expect(result.dimensions.responseSpeed).toBeDefined();
    expect(result.dimensions.paidPerformance.status).toBe("warning");
  });
});
