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
  conversationCompletion: DimensionResult;
  automation: DimensionResult;
  profileCompleteness: DimensionResult;
  paidPerformance: DimensionResult;
  complianceHygiene: DimensionResult;
}

export interface AuditScore {
  overall: number;
  dimensions: AuditDimensionScores;
}

export const DIMENSION_WEIGHTS: Record<keyof AuditDimensionScores, number> = {
  responseSpeed:          0.30,
  answerRate:             0.20,
  conversationCompletion: 0.10,
  automation:             0.10,
  profileCompleteness:    0.10,
  paidPerformance:        0.10,
  complianceHygiene:      0.10,
};

export const DIMENSION_LABELS: Record<keyof AuditDimensionScores, string> = {
  responseSpeed:          "Response Speed",
  answerRate:             "Answer Rate",
  conversationCompletion: "Conversation Completion",
  automation:             "Automation",
  profileCompleteness:    "Profile & Catalog Completeness",
  paidPerformance:        "Paid Conversation Performance",
  complianceHygiene:      "Compliance Hygiene",
};
