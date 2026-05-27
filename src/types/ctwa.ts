export type MatchConfidence = "exact" | "fuzzy" | "campaign" | "unmatched";

export interface CTWAConversation {
  chatRef: string;
  referral: Record<string, unknown>;
  adHeadline: string | null;
  sourceUrl: string | null;
  answered: boolean;
  firstResponseSeconds: number | null;
}

export interface CTWAMatchResult extends CTWAConversation {
  matchedMetaRowId: string | null;
  matchConfidence: MatchConfidence;
}

export interface MetaAdRow {
  id: string;
  audit_id: string;
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  results: number | null;
  source: "csv" | "api";
  raw_row: Record<string, unknown> | null;
}

export interface CTWAMetrics {
  totalCTWAConversations: number;
  matchedToAd: number;
  coveragePct: number;
  ctwaShareOfTotal: number;
  costPerConversation: number;
  answeredPaidLeadRate: number;
  wastedSpendEstimate: number;
  costPerAnsweredConversation: number;
  totalMatchedSpend: number;
  answeredCTWACount: number;
  unansweredCTWACount: number;
}

export interface ParsedSpreadsheetRow {
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  results: number | null;
  raw_row: Record<string, string | number | null>;
}

export interface ColumnMapping {
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  spend: string | null;
  impressions: string | null;
  clicks: string | null;
  results: string | null;
}
