import {
  analyzeChatContent,
  aggregateContentAnalysis,
  computeRevenueAtRisk,
  BOOKING_RE,
  PRICE_RE,
  CONFIRMATION_RE,
  CLOSE_RATE,
} from "@/lib/contentAnalysis";
import type { EvolutionMessage } from "@/types/evolution";

function makeMsg(
  fromMe: boolean,
  ts: number,
  text: string,
  jid = "601x@s.whatsapp.net"
): EvolutionMessage {
  return {
    key: { remoteJid: jid, fromMe, id: `${jid}-${ts}` },
    messageTimestamp: ts,
    message: { conversation: text },
  };
}

// ── Regex smoke tests ─────────────────────────────────────────────────────────

describe("BOOKING_RE", () => {
  test.each([
    "book an appointment",
    "Tempah slot untuk esok",
    "boleh datang next week?",
    "预约明天",
    "schedule a visit",
    "tarikh available?",
  ])("matches: %s", (text) => expect(BOOKING_RE.test(text)).toBe(true));

  test("does not match unrelated text", () => {
    expect(BOOKING_RE.test("thank you for calling")).toBe(false);
  });
});

describe("PRICE_RE", () => {
  test.each([
    "berapa harga treatment?",
    "RM 350 for braces",
    "what is the cost",
    "pakej whitening berapa",
    "价格多少",
    "how much deposit",
  ])("matches: %s", (text) => expect(PRICE_RE.test(text)).toBe(true));
});

describe("CONFIRMATION_RE", () => {
  test.each([
    "confirmed!",
    "dah book",
    "see you tomorrow",
    "noted, baik",
    "确认了",
    "already booked",
  ])("matches: %s", (text) => expect(CONFIRMATION_RE.test(text)).toBe(true));
});

// ── analyzeChatContent ────────────────────────────────────────────────────────

describe("analyzeChatContent", () => {
  test("empty messages returns safe defaults", () => {
    const result = analyzeChatContent("jid", []);
    expect(result.inboundInitiated).toBe(false);
    expect(result.hasBookingIntent).toBe(false);
    expect(result.isConfirmed).toBe(false);
    expect(result.isBusinessGhosted).toBe(false);
  });

  test("detects inbound-initiated chat", () => {
    const msgs = [makeMsg(false, 1000, "hi I want to book"), makeMsg(true, 1100, "sure! confirmed")];
    const result = analyzeChatContent("jid", msgs);
    expect(result.inboundInitiated).toBe(true);
    expect(result.hasBookingIntent).toBe(true);
    expect(result.isConfirmed).toBe(true);
  });

  test("detects price inquiry in EN", () => {
    const msgs = [makeMsg(false, 1000, "what is the price for scaling?"), makeMsg(true, 1100, "RM 140")];
    const result = analyzeChatContent("jid", msgs);
    expect(result.hasPriceDiscussion).toBe(true);
  });

  test("detects Malay booking intent", () => {
    const msgs = [makeMsg(false, 1000, "boleh tempah slot untuk khamis?")];
    const result = analyzeChatContent("jid", msgs);
    expect(result.hasBookingIntent).toBe(true);
  });

  test("detects Mandarin booking keyword", () => {
    const msgs = [makeMsg(false, 1000, "我想预约明天的时间")];
    const result = analyzeChatContent("jid", msgs);
    expect(result.hasBookingIntent).toBe(true);
  });

  test("business ghosted — last message from customer", () => {
    const msgs = [
      makeMsg(false, 1000, "hi berapa harga"),
      makeMsg(true, 1100, "RM 350"),
      makeMsg(false, 1200, "okay nak book"),
    ];
    const result = analyzeChatContent("jid", msgs);
    expect(result.isBusinessGhosted).toBe(true);
    expect(result.hadAnyBusinessReply).toBe(true);
    expect(result.dropoffStage).toBe("post-intent");
  });

  test("price-dropoff stage assigned correctly", () => {
    const msgs = [
      makeMsg(false, 1000, "hi"),
      makeMsg(true, 1100, "hello! how can I help?"),
      makeMsg(false, 1200, "berapa harga treatment?"),
      makeMsg(true, 1300, "RM 250"),
      makeMsg(false, 1400, "ok thanks"),
      // customer sends last — no booking intent shown
    ];
    const result = analyzeChatContent("jid", msgs);
    expect(result.isBusinessGhosted).toBe(true);
    expect(result.dropoffStage).toBe("post-price");
  });

  test("greeting dropoff — no price or intent discussed", () => {
    const msgs = [makeMsg(false, 1000, "hi"), makeMsg(false, 1100, "hello?")];
    const result = analyzeChatContent("jid", msgs);
    expect(result.isBusinessGhosted).toBe(true);
    expect(result.hadAnyBusinessReply).toBe(false);
    expect(result.dropoffStage).toBe("greeting");
  });

  test("confirmed booking — NOT marked as ghosted", () => {
    const msgs = [
      makeMsg(false, 1000, "I want to book"),
      makeMsg(true, 1100, "Sure, confirmed! See you Friday"),
    ];
    const result = analyzeChatContent("jid", msgs);
    expect(result.isConfirmed).toBe(true);
    expect(result.isBusinessGhosted).toBe(false);
  });
});

// ── aggregateContentAnalysis ──────────────────────────────────────────────────

describe("aggregateContentAnalysis", () => {
  test("counts are correct for mixed chat set", () => {
    const analyses = [
      // 1. Confirmed booking
      analyzeChatContent("j1", [
        makeMsg(false, 1000, "book appointment", "j1"),
        makeMsg(true,  1100, "confirmed!", "j1"),
      ]),
      // 2. Price dropoff (ghosted, had reply)
      analyzeChatContent("j2", [
        makeMsg(false, 1000, "berapa harga", "j2"),
        makeMsg(true,  1100, "RM 300", "j2"),
        makeMsg(false, 1200, "ok thanks", "j2"),
      ]),
      // 3. Unanswered greeting (ghosted, no business reply)
      analyzeChatContent("j3", [
        makeMsg(false, 1000, "hi", "j3"),
      ]),
    ];
    const agg = aggregateContentAnalysis(analyses);
    expect(agg.inboundChats).toBe(3);
    expect(agg.confirmedCount).toBe(1);
    expect(agg.bookingIntentCount).toBe(1);
    expect(agg.businessGhostCount).toBe(2);
    expect(agg.engagedThenGhostedCount).toBe(1); // j2 had a reply
    expect(agg.priceDropoffCount).toBe(1);
  });
});

// ── computeRevenueAtRisk ──────────────────────────────────────────────────────

describe("computeRevenueAtRisk", () => {
  test("dental example: braces RM 3899 avg ticket", () => {
    const result = computeRevenueAtRisk(10, 5, 3899);
    expect(result.lostLeadPool).toBe(15);
    expect(result.low).toBe(Math.round(15 * 3899 * CLOSE_RATE.conservative));
    expect(result.high).toBe(Math.round(15 * 3899 * CLOSE_RATE.optimistic));
  });

  test("low = conservative 20%, high = optimistic 40%", () => {
    const result = computeRevenueAtRisk(5, 5, 200);
    expect(result.low).toBe(Math.round(10 * 200 * 0.20));
    expect(result.high).toBe(Math.round(10 * 200 * 0.40));
  });

  test("no lost leads returns zero risk", () => {
    const result = computeRevenueAtRisk(0, 0, 500);
    expect(result.lostLeadPool).toBe(0);
    expect(result.low).toBe(0);
    expect(result.high).toBe(0);
  });

  test("math string is human-readable", () => {
    const result = computeRevenueAtRisk(3, 2, 1000);
    expect(result.math).toContain("5 uncaptured leads");
    expect(result.math).toContain("RM1000");
    expect(result.math).toContain("20");
    expect(result.math).toContain("40");
  });
});
