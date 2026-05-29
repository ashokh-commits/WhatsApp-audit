"use client";

import type { AuditDimensionScores } from "@/types/scoring";
import type { AuditMetrics } from "@/types/audit";
import { DIMENSION_LABELS, DIMENSION_WEIGHTS } from "@/types/scoring";
import Card, { CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ExportButton from "./ExportButton";
import PaidLeakageSection from "./PaidLeakageSection";
import { formatPct } from "@/lib/utils/format";


function PeakHoursChart({ hourly }: { hourly: number[] }) {
  const max = Math.max(...hourly, 1);
  const peakThreshold = max * 0.65;
  return (
    <div>
      <div className="flex items-end gap-px h-24">
        {hourly.map((count, hour) => {
          const heightPct = Math.max((count / max) * 100, count > 0 ? 4 : 0);
          const isPeak = count >= peakThreshold && count > 0;
          return (
            <div
              key={hour}
              title={`${hour}:00 — ${count} messages`}
              className="flex-1 rounded-t-sm transition-all"
              style={{
                height: `${heightPct}%`,
                backgroundColor: count === 0 ? "#252525" : isPeak ? "#FF4500" : "#059669",
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 font-body text-[10px] text-gray-500">
        <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
      </div>
      <div className="flex items-center gap-4 mt-2">
        <span className="flex items-center gap-1.5 font-body text-xs text-gray-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" /> Non-peak
        </span>
        <span className="flex items-center gap-1.5 font-body text-xs text-gray-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-g6-accent inline-block" /> Peak
        </span>
      </div>
    </div>
  );
}


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
  avgTicketValue?: number;
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
  const weightPct = typeof weight === "number" && isFinite(weight) ? Math.round(weight * 100) : null;
  const label = DIMENSION_LABELS[dimKey];

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-heading text-sm font-semibold text-white">{label}</h3>
          {weightPct != null && weightPct > 0 && (
            <p className="font-body text-xs text-gray-500">{weightPct}% weight</p>
          )}
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

export default function AuditReport({ audit, clientName, avgTicketValue = 0, ctwaRows, metaRows }: Props) {
  const dims = audit.dimension_scores as AuditDimensionScores | null;
  const metrics = audit.metrics as AuditMetrics | null;
  const score = audit.overall_score ?? 0;
  const rar = metrics?.revenueAtRisk;

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
      severity: (100 - dims[k].score) * (DIMENSION_WEIGHTS[k] ?? 0),
    }))
    .filter((d) => d.score < 75)
    .sort((a, b) => b.severity - a.severity);

  const coverage = metrics?.coveragePct ?? 0;
  const hourlyActivity = metrics?.hourlyActivity ?? null;

  return (
    <div className="space-y-8">

      {/* ── Revenue at Risk Hero ───────────────────────────────────────────── */}
      {rar && rar.lostLeadPool > 0 && (
        <div className="rounded-2xl border border-g6-accent/40 bg-gradient-to-br from-g6-card via-g6-card to-[#1f0d00] p-5 md:p-6 glow-orange">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-widest text-g6-accent mb-1">
                Revenue at Risk
              </p>
              <p className="font-heading text-3xl md:text-4xl font-bold text-white">
                RM {rar.low.toLocaleString()}
                <span className="text-gray-400 font-normal text-xl"> – </span>
                RM {rar.high.toLocaleString()}
              </p>
              <p className="font-body text-sm text-gray-400 mt-1">{rar.math}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:flex md:gap-4 shrink-0">
              <div className="rounded-xl bg-g6-surface border border-g6-border px-4 py-3 text-center">
                <p className="font-heading text-2xl font-bold text-white">{rar.lostLeadPool}</p>
                <p className="font-body text-xs text-gray-500 mt-0.5">Uncaptured Leads</p>
              </div>
              {avgTicketValue > 0 && (
                <div className="rounded-xl bg-g6-surface border border-g6-border px-4 py-3 text-center">
                  <p className="font-heading text-2xl font-bold text-white">RM {avgTicketValue.toLocaleString()}</p>
                  <p className="font-body text-xs text-gray-500 mt-0.5">Avg Ticket Value</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── No avg_ticket_value nudge ──────────────────────────────────────── */}
      {!rar && avgTicketValue === 0 && (metrics?.businessGhostCount ?? 0) + (dims.answerRate.rawMetric as { total?: number; answered?: number } | null
        ? (dims.answerRate.rawMetric as { total: number; answered: number }).total -
          (dims.answerRate.rawMetric as { total: number; answered: number }).answered
        : 0) > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p className="font-body text-sm text-amber-400">
            <span className="font-semibold">Set an average ticket value</span> in your client profile to unlock the Revenue at Risk calculation.
          </p>
        </div>
      )}

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
        <ExportButton auditId={audit.id} />
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

      {/* Revenue Detail — Booking + Drop-off */}
      {(metrics?.bookingIntentCount !== undefined || metrics?.businessGhostCount !== undefined) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Lead → Booking */}
          <Card className="flex flex-col gap-4">
            <div>
              <CardTitle>Lead → Booking Conversion</CardTitle>
              <p className="font-body text-xs text-gray-500 mt-0.5">How many inbound chats moved toward a booking</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-g6-surface border border-g6-border p-3 text-center">
                <p className="font-heading text-xl font-bold text-white">{metrics?.bookingIntentCount ?? 0}</p>
                <p className="font-body text-[10px] text-gray-500 mt-0.5">Intent</p>
              </div>
              <div className="rounded-lg bg-g6-surface border border-g6-border p-3 text-center">
                <p className="font-heading text-xl font-bold text-emerald-400">{metrics?.confirmedCount ?? 0}</p>
                <p className="font-body text-[10px] text-gray-500 mt-0.5">Confirmed</p>
              </div>
              <div className="rounded-lg bg-g6-surface border border-g6-border p-3 text-center">
                <p className="font-heading text-xl font-bold text-white">
                  {metrics?.bookingIntentCount
                    ? ((( metrics.confirmedCount ?? 0) / metrics.bookingIntentCount) * 100).toFixed(0)
                    : "—"}%
                </p>
                <p className="font-body text-[10px] text-gray-500 mt-0.5">Close Rate</p>
              </div>
            </div>
            <p className="font-body text-xs text-gray-400">{dims.bookingConversion?.businessImpact}</p>
          </Card>

          {/* Drop-off / Ghosting */}
          <Card className="flex flex-col gap-4">
            <div>
              <CardTitle>Drop-off &amp; Ghosting</CardTitle>
              <p className="font-body text-xs text-gray-500 mt-0.5">Where leads fell through the cracks</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-g6-surface border border-g6-border p-3 text-center">
                <p className="font-heading text-xl font-bold text-red-400">{metrics?.businessGhostCount ?? 0}</p>
                <p className="font-body text-[10px] text-gray-500 mt-0.5">Ghosted</p>
              </div>
              <div className="rounded-lg bg-g6-surface border border-g6-border p-3 text-center">
                <p className="font-heading text-xl font-bold text-amber-400">{metrics?.priceDropoffCount ?? 0}</p>
                <p className="font-body text-[10px] text-gray-500 mt-0.5">After Price</p>
              </div>
              <div className="rounded-lg bg-g6-surface border border-g6-border p-3 text-center">
                <p className="font-heading text-xl font-bold text-amber-400">{metrics?.postIntentDropoffCount ?? 0}</p>
                <p className="font-body text-[10px] text-gray-500 mt-0.5">After Intent</p>
              </div>
            </div>
            <p className="font-body text-xs text-gray-400">{dims.dropoffGhosting?.businessImpact}</p>
          </Card>
        </div>
      )}

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

      {/* Peak Hours */}
      {hourlyActivity && hourlyActivity.some((v: number) => v > 0) && (
        <Card>
          <CardTitle className="mb-1">Message Activity by Hour</CardTitle>
          <p className="font-body text-xs text-gray-500 mb-4">
            When customers send messages — helps schedule staffing and automation
          </p>
          <PeakHoursChart hourly={hourlyActivity} />
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
