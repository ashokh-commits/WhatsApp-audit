"use client";

import Card, { CardTitle } from "@/components/ui/Card";
import type { AuditMetrics } from "@/types/audit";
import { formatCurrency, formatPct } from "@/lib/utils/format";
import { formatSeconds } from "@/lib/utils/time";

interface Props {
  ctwaRows: Record<string, unknown>[];
  metaRows: Record<string, unknown>[];
  metrics: AuditMetrics | null;
  coveragePct: number;
}

interface LeakageRow {
  campaignName: string;
  adName: string | null;
  spend: number;
  started: number;
  answered: number;
  unanswered: number;
  medianResponseSeconds: number | null;
  wastedSpend: number;
}

function buildLeakage(
  ctwaRows: Record<string, unknown>[],
  metaRows: Record<string, unknown>[]
): LeakageRow[] {
  const metaById = new Map(metaRows.map((r) => [r.id, r]));
  const groups = new Map<string, {
    adName: string | null;
    spend: number;
    rows: Record<string, unknown>[];
  }>();

  for (const row of ctwaRows) {
    const metaRow = row.matched_meta_row_id
      ? metaById.get(row.matched_meta_row_id as string)
      : null;
    const key = (metaRow?.campaign_name as string) ?? "Unattributed";
    const existing = groups.get(key) ?? {
      adName: (metaRow?.ad_name as string | null) ?? null,
      spend: (metaRow?.spend as number) ?? 0,
      rows: [],
    };
    existing.rows.push(row);
    groups.set(key, existing);
  }

  const table: LeakageRow[] = [];
  for (const [campaignName, g] of Array.from(groups.entries())) {
    const answered = g.rows.filter((r: Record<string, unknown>) => r.answered);
    const unanswered = g.rows.filter((r: Record<string, unknown>) => !r.answered);
    const times = answered
      .map((r: Record<string, unknown>) => r.first_response_seconds as number | null)
      .filter((t): t is number => t !== null);
    const medianTime =
      times.length > 0
        ? times.sort((a, b) => a - b)[Math.floor(times.length / 2)]
        : null;

    table.push({
      campaignName,
      adName: g.adName,
      spend: g.spend,
      started: g.rows.length,
      answered: answered.length,
      unanswered: unanswered.length,
      medianResponseSeconds: medianTime,
      wastedSpend:
        g.rows.length > 0
          ? g.spend * (unanswered.length / g.rows.length)
          : 0,
    });
  }

  return table.sort((a, b) => b.wastedSpend - a.wastedSpend);
}

export default function PaidLeakageSection({ ctwaRows, metaRows, metrics, coveragePct }: Props) {
  const ctwaMetrics = metrics?.ctwaMetrics;

  if (!ctwaMetrics && ctwaRows.length === 0) {
    return (
      <Card>
        <CardTitle className="mb-2">Paid Lead Leakage</CardTitle>
        <p className="font-body text-sm text-gray-400">
          No CTWA ad data found. Upload a Meta Ads CSV on the{" "}
          <a href="/ctwa/import" className="text-g6-accent hover:underline">
            Import Ads
          </a>{" "}
          page and re-run the audit to see paid performance.
        </p>
      </Card>
    );
  }

  const leakage = buildLeakage(ctwaRows, metaRows);
  const totalWasted = leakage.reduce((s, r) => s + r.wastedSpend, 0);
  const totalSpend = ctwaMetrics?.totalMatchedSpend ?? leakage.reduce((s, r) => s + r.spend, 0);

  return (
    <div className="space-y-4">
      {/* Hero stat */}
      <Card className="border-red-500/30 bg-red-500/5">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="font-body text-xs text-gray-400 uppercase tracking-wide">Est. Wasted Ad Spend</p>
            <p className="font-heading text-3xl font-bold text-red-400">
              {formatCurrency(totalWasted)}
            </p>
          </div>
          {ctwaMetrics && (
            <>
              <div>
                <p className="font-body text-xs text-gray-400 uppercase tracking-wide">Total CTWA Conversations</p>
                <p className="font-heading text-2xl font-bold text-white">
                  {ctwaMetrics.totalCTWAConversations}
                </p>
              </div>
              <div>
                <p className="font-body text-xs text-gray-400 uppercase tracking-wide">Answered Paid Leads</p>
                <p className="font-heading text-2xl font-bold text-white">
                  {formatPct(ctwaMetrics.answeredPaidLeadRate * 100)}
                </p>
              </div>
              <div>
                <p className="font-body text-xs text-gray-400 uppercase tracking-wide">Cost / Answered Lead</p>
                <p className="font-heading text-2xl font-bold text-white">
                  {formatCurrency(ctwaMetrics.costPerAnsweredConversation)}
                </p>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Low coverage caveat */}
      {coveragePct > 0 && coveragePct < 0.6 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-body text-sm text-amber-400">
          ⚠ Match coverage is {formatPct(coveragePct * 100)} — only {formatPct(coveragePct * 100)} of CTWA
          conversations could be matched to specific ad rows. Spend figures are estimates only.
          Upload more detailed Meta Ads data for better accuracy.
        </div>
      )}

      {/* Leakage table */}
      <Card>
        <CardTitle className="mb-4">Paid Lead Leakage by Campaign</CardTitle>
        <p className="mb-3 font-body text-xs text-gray-500">
          Sorted by estimated wasted spend (worst first)
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm font-body">
            <thead>
              <tr className="border-b border-g6-border text-xs text-gray-400">
                <th className="pb-2 pr-4 text-left font-medium">Campaign</th>
                <th className="pb-2 pr-4 text-right font-medium">Spend</th>
                <th className="pb-2 pr-4 text-right font-medium">Started</th>
                <th className="pb-2 pr-4 text-right font-medium">Answered</th>
                <th className="pb-2 pr-4 text-right font-medium">Unanswered</th>
                <th className="pb-2 pr-4 text-right font-medium">Median Reply</th>
                <th className="pb-2 text-right font-medium text-red-400">Est. Wasted</th>
              </tr>
            </thead>
            <tbody>
              {leakage.map((row, i) => (
                <tr key={i} className="border-b border-g6-border/50 last:border-0">
                  <td className="py-2 pr-4 text-white">
                    <div>{row.campaignName}</div>
                    {row.adName && (
                      <div className="text-xs text-gray-500">{row.adName}</div>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">
                    {formatCurrency(row.spend)}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">{row.started}</td>
                  <td className="py-2 pr-4 text-right text-emerald-400">{row.answered}</td>
                  <td className="py-2 pr-4 text-right text-red-400">{row.unanswered}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">
                    {row.medianResponseSeconds != null
                      ? formatSeconds(row.medianResponseSeconds)
                      : "—"}
                  </td>
                  <td className="py-2 text-right font-semibold text-red-400">
                    {formatCurrency(row.wastedSpend)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-g6-border font-semibold">
                <td className="pt-3 pr-4 text-gray-300 font-heading">Total</td>
                <td className="pt-3 pr-4 text-right text-gray-300">
                  {formatCurrency(totalSpend)}
                </td>
                <td className="pt-3 pr-4 text-right text-gray-300">
                  {leakage.reduce((s, r) => s + r.started, 0)}
                </td>
                <td className="pt-3 pr-4 text-right text-emerald-400">
                  {leakage.reduce((s, r) => s + r.answered, 0)}
                </td>
                <td className="pt-3 pr-4 text-right text-red-400">
                  {leakage.reduce((s, r) => s + r.unanswered, 0)}
                </td>
                <td className="pt-3 pr-4" />
                <td className="pt-3 text-right text-red-400">
                  {formatCurrency(totalWasted)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
