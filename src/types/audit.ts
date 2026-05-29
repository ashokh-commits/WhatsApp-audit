import type { AuditDimensionScores } from "./scoring";
import type { CTWAMetrics } from "./ctwa";

export interface AuditProgress {
  stage: string;
  pct: number;
  chatsProcessed?: number;
  chatsTotal?: number;
}

export interface RevenueAtRisk {
  lostLeadPool: number;
  low: number;
  high: number;
  avgTicketValue: number;
  math: string;
}

export interface AuditMetrics {
  progress?: AuditProgress;
  businessProfile?: Record<string, unknown>;
  chatCount?: number;
  chatsInWindow?: number;  // total chats within the window (may exceed chatCount if partial)
  partial?: boolean;       // true when time budget ran out before all chats were fetched
  ctwaConversationCount?: number;
  coveragePct?: number;
  ctwaMetrics?: CTWAMetrics;
  windowDays?: number;
  windowStart?: string;
  windowEnd?: string;
  hourlyActivity?: number[];
  // Revenue Layer v2
  bookingIntentCount?: number;
  confirmedCount?: number;
  bookingIntentRate?: number;
  confirmedRate?: number;
  businessGhostCount?: number;
  engagedThenGhostedCount?: number;
  priceDropoffCount?: number;
  postIntentDropoffCount?: number;
  revenueAtRisk?: RevenueAtRisk;
}

export interface AuditRow {
  id: string;
  client_id: string;
  window_days: number;
  overall_score: number | null;
  dimension_scores: AuditDimensionScores | null;
  metrics: AuditMetrics | null;
  status: "pending" | "running" | "complete" | "failed";
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  created_by: string | null;
}

export interface ClientWithLastAudit {
  id: string;
  name: string;
  instance_name: string;
  created_at: string;
  lastAudit: {
    id: string;
    overall_score: number | null;
    status: string;
    created_at: string;
  } | null;
  hasConsent: boolean;
}
