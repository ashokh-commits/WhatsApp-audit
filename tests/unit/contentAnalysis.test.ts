import {
  analyzeChatContent,
  aggregateContentAnalysis,
  computeRevenueAtRisk,
  BOOKING_RE,
  PRICE_RE,
  PHONE_RE,
  TIME_SLOT_RE,
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

describe("BOOKING_RE — inbound appointment intent keywords", () => {
  test.each([
    "I want to book an appointment",
    "Tempah slot untuk esok",
    "ada slot jumaat?",
    "consultation free ke?",
    "free tak?",
    "walk-in boleh?",
    "check-up ada ke?",
    "预约明天",
    "boleh datang isnin?",
    "can I make an appointment",
    "still available this week?",
    "rawatan apa ada?",
    "nak buat treatment",
  ])("matches: %s", (text) => expect(BOOKING_RE.test(text)).toBe(true));

  test("does not match generic replies like 'thank you'", () => {
    expect(BOOKING_RE.test("thank you for the info")).toBe(false);
    expect(BOOKING_RE.test("ok noted")).toBe(false);
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

describe("PHONE_RE — Malaysian phone numbers", () => {
  test.each([
    "0123456789",
    "012-345 6789",
    "+60123456789",
    "601234567890",
    "no saya 0197654321",
  ])("matches: %s", (text) => expect(PHONE_RE.test(text)).toBe(true));

  test("does not match short random numbers", () => {
    expect(PHONE_RE.test("RM 350")).toBe(false);
    expect(PHONE_RE.test("I want 3 slots")).toBe(false);
  });
});

describe("TIME_SLOT_RE", () => {
  test.each([
    "10am",
    "3pm tomorrow",
    "jumaat pagi",
    "petang boleh?",
    "next week isnin",
    "15 jan",
    "10:30",
  ])("matches: %s", (text) => expect(TIME_SLOT_RE.test(text)).toBe(true));
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

  test("booking intent detected from inbound 'ada slot jumaat?'", () => {
    const msgs = [
      makeMsg(false, 1000, "ada slot jumaat?"),
      makeMsg(true, 1100, "ada! nama dan no telefon?"),
    ];
    const result = analyzeChatContent("jid", msgs);
    expect(result.hasBookingIntent).toBe(true);
    expect(result.inboundInitiated).toBe(true);
  });

  test("booking intent NOT detected when business asks about slot (outbound)", () => {
    const msgs = [
      makeMsg(false, 1000, "hi"),
      makeMsg(true, 1100, "ada slot untuk appointment esok"),
    ];
    const result = analyzeChatContent("jid", msgs);
    // Business message contains booking keywords — should NOT trigger hasBookingIntent
    expect(result.hasBookingIntent).toBe(false);
  });

  test("confirmed when customer provides phone number after business reply", () => {
    const msgs = [
      makeMsg(false, 1000, "nak book appointment"),
      makeMsg(true,  1100, "boleh! nama dan no telefon?"),
      makeMsg(false, 1200, "Sarah, 0123456789, boleh jumaat pagi"),
    ];
    const result = analyzeChatContent("jid", msgs);
    expect(result.isConfirmed).toBe(true);
    expect(result.hasBookingIntent).toBe(true);
  });

  test("NOT confirmed if phone number sent before business replies", () => {
    // Customer sends phone number in first message — edge case, not a booking confirmation
    const msgs = [
      makeMsg(false, 1000, "hi my number is 0123456789 please call me"),
    ];
    const result = analyzeChatContent("jid", msgs);
    expect(result.isConfirmed).toBe(false); // no business reply yet
  });

  test("NOT confirmed if only name and time sent but no phone number", () => {
    const msgs = [
      makeMsg(false, 1000, "nak book"),
      makeMsg(true,  1100, "nama dan no telefon?"),
      makeMsg(false, 1200, "Sarah, jumaat pagi"),
    ];
    const result = analyzeChatContent("jid", msgs);
    expect(result.isConfirmed).toBe(false);
  });

  test("detects consultation free ke? as booking intent", () => {
    const msgs = [
      makeMsg(false, 1000, "consultation free ke? nak tanya pasal braces"),
    ];
    const result = analyzeChatContent("jid", msgs);
    expect(result.hasBookingIntent).toBe(true);
  });

  test("detects walk-in as booking intent", () => {
    const msgs = [makeMsg(false, 1000, "walk-in boleh ke doktor?")];
    const result = analyzeChatContent("jid", msgs);
    expect(result.hasBookingIntent).toBe(true);
  });

  test("detects price discussion from inbound", () => {
    const msgs = [
      makeMsg(false, 1000, "berapa harga scaling?"),
      makeMsg(true, 1100, "RM 140"),
    ];
    const result = analyzeChatContent("jid", msgs);
    expect(result.hasPriceDiscussion).toBe(true);
  });

  test("business ghosted — last message from customer", () => {
    const msgs = [
      makeMsg(false, 1000, "nak book appointment"),
      makeMsg(true,  1100, "nama dan no telefon?"),
      makeMsg(false, 1200, "Sarah, 0123456789, jumaat pagi"),
      makeMsg(false, 1300, "still available ke?"),
    ];
    const result = analyzeChatContent("jid", msgs);
    expect(result.isBusinessGhosted).toBe(true);
    expect(result.isConfirmed).toBe(true); // confirmed because phone was given
    expect(result.hadAnyBusinessReply).toBe(true);
  });

  test("price-dropoff stage when customer last message follows price inquiry", () => {
    const msgs = [
      makeMsg(false, 1000, "hi"),
      makeMsg(true,  1100, "hello! how can I help?"),
      makeMsg(false, 1200, "berapa harga whitening?"),
      makeMsg(true,  1300, "RM 250"),
      makeMsg(false, 1400, "ok nanti fikir"),
    ];
    const result = analyzeChatContent("jid", msgs);
    expect(result.isBusinessGhosted).toBe(true);
    expect(result.dropoffStage).toBe("post-price");
  });

  test("post-intent dropoff when customer dropped off after asking about slot", () => {
    const msgs = [
      makeMsg(false, 1000, "ada slot isnin?"),
      makeMsg(true,  1100, "ada! nama?"),
      makeMsg(false, 1200, "ok fikir dulu"),
    ];
    const result = analyzeChatContent("jid", msgs);
    expect(result.isBusinessGhosted).toBe(true);
    expect(result.dropoffStage).toBe("post-intent");
  });

  test("greeting dropoff — no price or intent discussed", () => {
    const msgs = [makeMsg(false, 1000, "hi"), makeMsg(false, 1100, "hello?")];
    const result = analyzeChatContent("jid", msgs);
    expect(result.isBusinessGhosted).toBe(true);
    expect(result.hadAnyBusinessReply).toBe(false);
    expect(result.dropoffStage).toBe("greeting");
  });
});

// ── aggregateContentAnalysis ──────────────────────────────────────────────────

describe("aggregateContentAnalysis", () => {
  test("counts are correct for mixed chat set", () => {
    const analyses = [
      // 1. Confirmed booking — customer gave phone, business replied to confirm
      analyzeChatContent("j1", [
        makeMsg(false, 1000, "nak book appointment", "j1"),
        makeMsg(true,  1100, "nama dan no?", "j1"),
        makeMsg(false, 1200, "Amy 0123456789 jumaat", "j1"),
        makeMsg(true,  1300, "ok confirmed jumaat 10am!", "j1"),
      ]),
      // 2. Price dropoff (ghosted, had reply)
      analyzeChatContent("j2", [
        makeMsg(false, 1000, "berapa harga scaling", "j2"),
        makeMsg(true,  1100, "RM 140", "j2"),
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
