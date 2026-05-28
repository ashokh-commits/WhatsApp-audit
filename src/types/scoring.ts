export type DimensionStatus = "good" | "warning" | "critical";

export interface DimensionResult {
  score: number;
  rawMetric: unknown;
  status: DimensionStatus;
  businessImpact: string;
}

export interface AuditDimensionScores {
  responseSpeed: DimensionResult;
  answerRate: DimensionResult;
  bookingConversion: DimensionResult;
  dropoffGhosting: DimensionResult;
  paidPerformance: DimensionResult;
  complianceHygiene: DimensionResult;
  profileCompleteness: DimensionResult;
  conversationCompletion: DimensionResult;
  automation: DimensionResult;
}

export interface AuditScore {
  overall: number;
  dimensions: AuditDimensionScores;
}

/** Weights used in overall score — must sum to 1.0 */
export const DIMENSION_WEIGHTS: Partial<Record<keyof AuditDimensionScores, number>> = {
  responseSpeed:          0.25,
  answerRate:             0.20,
  bookingConversion:      0.15,
  dropoffGhosting:        0.10,
  paidPerformance:        0.10,
  complianceHygiene:      0.10,
  profileCompleteness:    0.05,
  conversationCompletion: 0.05,
  // automation: excluded from weighted score (informational only)
};

export const DIMENSION_LABELS: Record<keyof AuditDimensionScores, string> = {
  responseSpeed:          "Response Speed",
  answerRate:             "Answer Rate",
  bookingConversion:      "Lead → Booking Conversion",
  dropoffGhosting:        "Drop-off / Ghosting",
  paidPerformance:        "Paid Conversation Performance",
  complianceHygiene:      "Compliance Hygiene",
  profileCompleteness:    "Profile Completeness",
  conversationCompletion: "Conversation Completion",
  automation:             "Automation",
};
