"use client";

import type { AuditDimensionScores } from "@/types/scoring";
import type { AuditMetrics } from "@/types/audit";
import { DIMENSION_LABELS, DIMENSION_WEIGHTS } from "@/types/scoring";
import Card, { CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ExportButton from "./ExportButton";
import PaidLeakageSection from "./PaidLeakageSection";
import { formatPct } from "@/lib/utils/format";

interface AuditRow {
  id: string;
  client_id: string;
  window_days: number;
  overall_score: number | null;
  dimension_scores: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Props {
  audit: AuditRow;
  clientName: string;
  ctwaRows: Record<string, unknown>[];
  metaRows: Record<string, unknown>[];
}

function OverallScoreRing({ score }: { score: number }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center">
        <svg width="128" height="128" className="-rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="#2A2D36" strokeWidth="10" />
          <circle
            cx="64" cy="64" r={r} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="font-heading text-3xl font-bold text-white">{score}</span>
          <span className="font-body text-xs text-gray-400">/ 100</span>
        </div>
      </div>
      <p className="font-body text-sm text-gray-400">Overall Score</p>
    </div>
  );
}

function DimensionCard({
  dimKey,
  result,
}: {
  dimKey: keyof AuditDimensionScores;
  result: AuditDimensionScores[typeof dimKey];
}) {
  const weight = DIMENSION_WEIGHTS[dimKey];
  const label = DIMENSION_LABELS[dimKey];

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-heading text-sm font-semibold text-white">{label}</h3>
          <p className="font-body text-xs text-gray-500">{(weight * 100).toFixed(0)}% weight</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-heading text-2xl font-bold text-white">{result.score}</span>
          <Badge status={result.status} />
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-g6-border">
        <div
          className={`h-full rounded-full transition-all ${
            result.status === "good"
              ? "bg-emerald-500"
              : result.status === "warning"
              ? "bg-amber-500"
              : "bg-red-500"
          }`}
          style={{ width: `${result.score}%` }}
        />
      </div>
      <p className="font-body text-xs text-gray-400">{result.businessImpact}</p>
    </Card>
  );
}

export default function AuditReport({ audit, clientName, ctwaRows, metaRows }: Props) {
  const dims = audit.dimension_scores as AuditDimensionScores | null;
  const metrics = audit.metrics as AuditMetrics | null;
  const score = audit.overall_score ?? 0;

  if (!dims) return null;

  // Build Top Fixes: dimensions sorted by (severity × weight) descending
  const dimensionKeys = Object.keys(dims) as Array<keyof AuditDimensionScores>;
  const topFixes = dimensionKeys
    .map((k) => ({
      key: k,
      label: DIMENSION_LABELS[k],
      score: dims[k].score,
      weight: DIMENSION_WEIGHTS[k],
      impact: dims[k].businessImpact,
      status: dims[k].status,
      severity: (100 - dims[k].score) * DIMENSION_WEIGHTS[k],
    }))
    .filter((d) => d.score < 75)
    .sort((a, b) => b.severity - a.severity);

  const coverage = metrics?.coveragePct ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-white">{clientName}</h2>
          <p className="font-body text-sm text-gray-400">
            {audit.window_days}-day audit window ending{" "}
            {audit.completed_at
              ? new Date(audit.completed_at).toLocaleDateString()
              : "—"}
          </p>
          <p className="font-body text-xs text-gray-500 mt-1">
            {metrics?.chatCount ?? 0} conversations analysed
            {metrics?.ctwaConversationCount
              ? ` · ${metrics.ctwaConversationCount} CTWA`
              : ""}
            {coverage > 0
              ? ` · ${formatPct(coverage * 100)} match coverage`
              : ""}
          </p>
        </div>
        <ExportButton audit={audit} clientName={clientName} />
      </div>

      {/* Score + Summary row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-center justify-center py-6">
          <OverallScoreRing score={score} />
        </Card>

        <Card className="md:col-span-2">
          <CardTitle className="mb-3">Score Breakdown</CardTitle>
          <div className="space-y-2">
            {dimensionKeys.map((k) => (
              <div key={k} className="flex items-center gap-3">
                <span className="w-40 font-body text-xs text-gray-400 shrink-0">
                  {DIMENSION_LABELS[k]}
                </span>
                <div className="flex-1 h-2 rounded-full bg-g6-border overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      dims[k].status === "good"
                        ? "bg-emerald-500"
                        : dims[k].status === "warning"
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${dims[k].score}%` }}
                  />
                </div>
                <span className="w-8 text-right font-heading text-sm text-white">
                  {dims[k].score}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 7 Dimension Cards */}
      <div>
        <h3 className="mb-4 font-heading text-lg font-semibold text-white">
          Dimension Analysis
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dimensionKeys.map((k) => (
            <DimensionCard key={k} dimKey={k} result={dims[k]} />
          ))}
        </div>
      </div>

      {/* Top Fixes */}
      {topFixes.length > 0 && (
        <Card>
          <CardTitle className="mb-4">Top Fixes (sorted by impact)</CardTitle>
          <ol className="space-y-3">
            {topFixes.map((fix, i) => (
              <li key={fix.key} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-g6-border font-heading text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-heading text-sm font-semibold text-white">
                    {fix.label}{" "}
                    <Badge status={fix.status} className="ml-1" />
                  </p>
                  <p className="font-body text-xs text-gray-400">{fix.impact}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Paid Lead Leakage */}
      <PaidLeakageSection
        ctwaRows={ctwaRows}
        metaRows={metaRows}
        metrics={metrics}
        coveragePct={coverage}
      />
    </div>
  );
}
