import {
  extractCTWAConversations,
  matchCTWAConversations,
  computeCTWAMetrics,
} from "@/lib/ctwa";
import type { SanitizedMessage } from "@/types/evolution";
import type { MetaAdRow } from "@/types/ctwa";

function makeMsg(
  remoteJid: string,
  fromMe: boolean,
  timestamp: number,
  referral?: Record<string, unknown>
): SanitizedMessage {
  return {
    id: `${remoteJid}-${timestamp}`,
    remoteJid,
    fromMe,
    timestamp,
    messageType: "extendedTextMessage",
    referral: referral ?? null,
    hasMedia: false,
  };
}

function makeMetaRow(overrides: Partial<MetaAdRow> = {}): MetaAdRow {
  return {
    id: overrides.id ?? "row-1",
    audit_id: "audit-1",
    campaign_name: overrides.campaign_name ?? "Summer Campaign",
    adset_name:    overrides.adset_name ?? null,
    ad_name:       overrides.ad_name ?? "Book a Consultation Ad",
    spend:         overrides.spend ?? 500,
    impressions:   overrides.impressions ?? 10000,
    clicks:        overrides.clicks ?? 120,
    results:       overrides.results ?? 30,
    source:        "csv",
    raw_row:       null,
  };
}

describe("extractCTWAConversations", () => {
  test("returns empty array when no referrals present", () => {
    const msgs = [
      makeMsg("chat1", false, 1000),
      makeMsg("chat1", true,  2000),
    ];
    expect(extractCTWAConversations(msgs)).toHaveLength(0);
  });

  test("extracts one CTWA conversation per chat with referral", () => {
    const msgs = [
      makeMsg("chat1", false, 1000, { headline: "Book Now", sourceUrl: "https://fb.com" }),
      makeMsg("chat1", true,  2000),
    ];
    const result = extractCTWAConversations(msgs);
    expect(result).toHaveLength(1);
    expect(result[0].adHeadline).toBe("Book Now");
    expect(result[0].answered).toBe(true);
    expect(result[0].firstResponseSeconds).toBe(1000);
  });

  test("marks conversation as unanswered if no fromMe reply", () => {
    const msgs = [
      makeMsg("chat1", false, 1000, { headline: "Promo" }),
    ];
    const result = extractCTWAConversations(msgs);
    expect(result[0].answered).toBe(false);
    expect(result[0].firstResponseSeconds).toBeNull();
  });

  test("deduplicates to one CTWA per chat even with multiple messages", () => {
    const msgs = [
      makeMsg("chat1", false, 1000, { headline: "Ad 1" }),
      makeMsg("chat1", false, 1500, { headline: "Ad 2" }),
      makeMsg("chat1", true,  2000),
    ];
    expect(extractCTWAConversations(msgs)).toHaveLength(1);
  });
});

describe("matchCTWAConversations", () => {
  test("exact match by sourceId", () => {
    const convos = extractCTWAConversations([
      makeMsg("chat1", false, 1000, { sourceId: "12345", headline: "Promo" }),
      makeMsg("chat1", true,  2000),
    ]);
    const rows = [makeMetaRow({ id: "row-1", ad_name: "12345" })];
    const matched = matchCTWAConversations(convos, rows);
    expect(matched[0].matchConfidence).toBe("exact");
    expect(matched[0].matchedMetaRowId).toBe("row-1");
  });

  test("fuzzy match on similar headline", () => {
    const convos = extractCTWAConversations([
      makeMsg("chat1", false, 1000, { headline: "Book a Consultation" }),
      makeMsg("chat1", true,  2000),
    ]);
    const rows = [makeMetaRow({ id: "row-1", ad_name: "Book a Consultation Ad" })];
    const matched = matchCTWAConversations(convos, rows);
    // headline and ad_name are similar enough
    expect(["fuzzy", "exact"]).toContain(matched[0].matchConfidence);
  });

  test("returns unmatched when no rows", () => {
    const convos = extractCTWAConversations([
      makeMsg("chat1", false, 1000, { headline: "Some Ad" }),
    ]);
    const matched = matchCTWAConversations(convos, []);
    expect(matched[0].matchConfidence).toBe("unmatched");
    expect(matched[0].matchedMetaRowId).toBeNull();
  });

  test("returns unmatched for dissimilar headline", () => {
    const convos = extractCTWAConversations([
      makeMsg("chat1", false, 1000, { headline: "Buy Widget Now" }),
    ]);
    const rows = [makeMetaRow({ ad_name: "Summer Discount Sale" })];
    const matched = matchCTWAConversations(convos, rows);
    expect(matched[0].matchConfidence).toBe("unmatched");
  });
});

describe("computeCTWAMetrics", () => {
  test("returns zero metrics for empty conversations", () => {
    const metrics = computeCTWAMetrics([], [], 100);
    expect(metrics.totalCTWAConversations).toBe(0);
    expect(metrics.wastedSpendEstimate).toBe(0);
  });

  test("correctly calculates wasted spend for unanswered CTWA", () => {
    const convos = extractCTWAConversations([
      makeMsg("chat1", false, 1000, { headline: "Book Now" }),
      makeMsg("chat2", false, 2000, { headline: "Book Now" }),
      makeMsg("chat2", true,  3000),
    ]);
    const rows = [makeMetaRow({ id: "row-1", spend: 1000, ad_name: "Book Now" })];
    const matched = matchCTWAConversations(convos, rows);
    const metrics = computeCTWAMetrics(matched, rows, 10);

    expect(metrics.totalCTWAConversations).toBe(2);
    expect(metrics.answeredCTWACount).toBe(1);
    expect(metrics.unansweredCTWACount).toBe(1);
    expect(metrics.answeredPaidLeadRate).toBe(0.5);
    expect(metrics.wastedSpendEstimate).toBeGreaterThan(0);
  });

  test("calculates CTWA share of total conversations", () => {
    const convos = extractCTWAConversations([
      makeMsg("chat1", false, 1000, { headline: "Ad" }),
    ]);
    const matched = matchCTWAConversations(convos, []);
    const metrics = computeCTWAMetrics(matched, [], 10);
    expect(metrics.ctwaShareOfTotal).toBe(0.1); // 1/10
  });
});
