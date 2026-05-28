import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Svg,
  Circle,
} from "@react-pdf/renderer";
import type { AuditDimensionScores } from "@/types/scoring";
import type { RevenueAtRisk } from "@/types/audit";
import { DIMENSION_LABELS, DIMENSION_WEIGHTS } from "@/types/scoring";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#111318",
    color: "#e5e7eb",
    padding: 40,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 24,
  },
  scoreText: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2D36",
  },
  dimRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2229",
  },
  dimLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    flex: 1,
  },
  dimWeight: {
    fontSize: 8,
    color: "#6b7280",
    width: 28,
    textAlign: "right",
  },
  dimScore: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    width: 30,
    textAlign: "right",
  },
  dimImpact: {
    fontSize: 8,
    color: "#9ca3af",
    flex: 2,
    marginLeft: 8,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#4b5563",
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  rarBox: {
    backgroundColor: "#1a0d00",
    borderWidth: 1,
    borderColor: "#7c2d0a",
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  rarLabel: {
    fontSize: 8,
    color: "#f97316",
    marginBottom: 4,
  },
  rarAmount: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  rarMath: {
    fontSize: 8,
    color: "#9ca3af",
  },
});

interface AuditForPdf {
  id: string;
  window_days: number;
  overall_score: number | null;
  dimension_scores: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

function scoreColor(score: number): string {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export default function AuditPdfDocument({
  audit,
  clientName,
}: {
  audit: AuditForPdf;
  clientName: string;
}) {
  const dims = audit.dimension_scores as AuditDimensionScores | null;
  const score = audit.overall_score ?? 0;
  const metrics = audit.metrics as Record<string, unknown> | null;
  const ctwaMetrics = metrics?.ctwaMetrics as import("@/types/ctwa").CTWAMetrics | undefined;
  const rar = metrics?.revenueAtRisk as RevenueAtRisk | undefined;

  const r = 42;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * r;
  const filled = (score / 100) * circumference;
  const gap = circumference - filled;

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <Text style={styles.title}>{clientName}</Text>
        <Text style={styles.subtitle}>
          WhatsApp Business Audit — {audit.window_days}-day window
          {audit.completed_at
            ? `  ·  ${new Date(audit.completed_at).toLocaleDateString()}`
            : ""}
        </Text>

        {/* Revenue at Risk */}
        {rar && rar.lostLeadPool > 0 && (
          <View style={styles.rarBox}>
            <Text style={styles.rarLabel}>REVENUE AT RISK</Text>
            <Text style={styles.rarAmount}>
              RM {rar.low.toLocaleString()} – RM {rar.high.toLocaleString()}
            </Text>
            <Text style={styles.rarMath}>{rar.math}</Text>
          </View>
        )}

        {/* Overall score ring */}
        <View style={{ alignItems: "center", marginBottom: 16 }}>
          <View style={{ width: 100, height: 100, position: "relative", alignItems: "center", justifyContent: "center" }}>
            <Svg width="100" height="100" viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0 }}>
              <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#2A2D36" strokeWidth="8" />
              <Circle
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={scoreColor(score)}
                strokeWidth="8"
                strokeDasharray={`${filled},${gap}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            </Svg>
            <Text style={[styles.scoreText, { color: scoreColor(score) }]}>{score}</Text>
          </View>
          <Text style={{ fontSize: 10, color: "#9ca3af" }}>Overall Score / 100</Text>
        </View>

        {/* Booking + drop-off summary */}
        {(metrics?.bookingIntentCount !== undefined) && (
          <>
            <Text style={styles.sectionTitle}>Lead Conversion</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Booking Intent</Text>
                <Text style={styles.metaValue}>{String(metrics.bookingIntentCount ?? 0)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Confirmed</Text>
                <Text style={[styles.metaValue, { color: "#10b981" }]}>{String(metrics.confirmedCount ?? 0)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Ghosted</Text>
                <Text style={[styles.metaValue, { color: "#ef4444" }]}>{String(metrics.businessGhostCount ?? 0)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>After Price</Text>
                <Text style={[styles.metaValue, { color: "#f59e0b" }]}>{String(metrics.priceDropoffCount ?? 0)}</Text>
              </View>
            </View>
          </>
        )}

        {/* Dimension scores */}
        {dims && (
          <>
            <Text style={styles.sectionTitle}>Dimension Analysis</Text>
            {(Object.keys(dims) as Array<keyof AuditDimensionScores>).map((k) => {
              const weight = DIMENSION_WEIGHTS[k];
              return (
                <View key={k} style={styles.dimRow}>
                  <Text style={styles.dimLabel}>{DIMENSION_LABELS[k]}</Text>
                  {weight != null && (
                    <Text style={styles.dimWeight}>{(weight * 100).toFixed(0)}%</Text>
                  )}
                  <Text style={[styles.dimScore, { color: scoreColor(dims[k].score) }]}>
                    {dims[k].score}
                  </Text>
                  <Text style={styles.dimImpact}>{dims[k].businessImpact}</Text>
                </View>
              );
            })}
          </>
        )}

        {/* CTWA summary */}
        {ctwaMetrics && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Paid Lead Performance</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Total CTWA Convos</Text>
                <Text style={styles.metaValue}>{ctwaMetrics.totalCTWAConversations}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Answered Rate</Text>
                <Text style={styles.metaValue}>
                  {(ctwaMetrics.answeredPaidLeadRate * 100).toFixed(0)}%
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Est. Wasted Spend</Text>
                <Text style={[styles.metaValue, { color: "#ef4444" }]}>
                  RM {ctwaMetrics.wastedSpendEstimate.toFixed(2)}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>G6 Labs Asia  ·  Build smarter. Scale faster.</Text>
          <Text>Audit ID: {audit.id.slice(0, 8)}</Text>
        </View>
      </Page>
    </Document>
  );
}
