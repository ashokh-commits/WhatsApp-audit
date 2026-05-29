import React from "react";
import {
  Document, Page, View, Text, StyleSheet,
  Svg, Circle, Rect, G, Line,
} from "@react-pdf/renderer";
import type { AuditDimensionScores } from "@/types/scoring";
import type { RevenueAtRisk } from "@/types/audit";
import { DIMENSION_LABELS, DIMENSION_WEIGHTS } from "@/types/scoring";

// SVG Text in react-pdf accepts fontSize/fontFamily but the type defs omit them
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SvgText = Text as React.ComponentType<any>;

// ── Brand colours ────────────────────────────────────────────────────────────
const C = {
  bg:        "#0A0A0A",
  surface:   "#141414",
  card:      "#1a1a1a",
  border:    "#252525",
  accent:    "#FF4500",
  good:      "#10b981",
  warning:   "#f59e0b",
  critical:  "#ef4444",
  white:     "#ffffff",
  grey1:     "#e5e7eb",
  grey2:     "#9ca3af",
  grey3:     "#6b7280",
  grey4:     "#374151",
};

const PAGE_W = 535; // usable (595 - 30*2)

const styles = StyleSheet.create({
  page:      { backgroundColor: C.bg, padding: 30, fontFamily: "Helvetica" },
  // ── layout helpers
  row:       { flexDirection: "row", gap: 10 },
  col:       { flex: 1 },
  mb4:       { marginBottom: 4 },
  mb8:       { marginBottom: 8 },
  mb12:      { marginBottom: 12 },
  mb16:      { marginBottom: 16 },
  // ── cards
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 10,
  },
  rarCard: {
    backgroundColor: "#140800",
    borderWidth: 1,
    borderColor: "#7c2d0a",
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  // ── section title
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.grey3,
    letterSpacing: 1,
    marginBottom: 8,
  },
  // ── footer
  footer: {
    position: "absolute", bottom: 22, left: 30, right: 30,
    flexDirection: "row", justifyContent: "space-between",
    fontSize: 7, color: C.grey4,
  },
  footerLine: {
    position: "absolute", bottom: 38, left: 30, right: 30,
    height: 1, backgroundColor: C.border,
  },
});

// ── helpers ──────────────────────────────────────────────────────────────────

function sc(score: number) {
  return score >= 75 ? C.good : score >= 50 ? C.warning : C.critical;
}

// ── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = sc(score);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Tick marks */}
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = (i / 20) * 2 * Math.PI - Math.PI / 2;
        const inner = r + 2;
        const outer = r + 6;
        return (
          <Line
            key={i}
            x1={cx + inner * Math.cos(angle)}
            y1={cy + inner * Math.sin(angle)}
            x2={cx + outer * Math.cos(angle)}
            y2={cy + outer * Math.sin(angle)}
            stroke={C.border}
            strokeWidth={1}
          />
        );
      })}
      {/* Background track */}
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a1a" strokeWidth={8} />
      {/* Progress arc */}
      <Circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeDasharray={`${filled},${circ - filled}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* Score label */}
      <SvgText x={cx} y={cy - 6} fill={color} fontSize={28} fontFamily="Helvetica-Bold" textAnchor="middle">
        {String(score)}
      </SvgText>
      <SvgText x={cx} y={cy + 10} fill={C.grey3} fontSize={9} fontFamily="Helvetica" textAnchor="middle">
        / 100
      </SvgText>
      <SvgText x={cx} y={cy + 22} fill={C.grey4} fontSize={7} fontFamily="Helvetica" textAnchor="middle">
        OVERALL
      </SvgText>
    </Svg>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color = C.white, accent = false,
}: {
  label: string; value: string; sub?: string;
  color?: string; accent?: boolean;
}) {
  return (
    <View style={[styles.card, styles.col, accent ? { borderColor: "#7c2d0a", backgroundColor: "#140800" } : {}]}>
      <Text style={{ fontSize: 7, color: C.grey3, marginBottom: 4 }}>{label.toUpperCase()}</Text>
      <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color }}>{value}</Text>
      {sub && <Text style={{ fontSize: 7, color: C.grey3, marginTop: 2 }}>{sub}</Text>}
    </View>
  );
}

// ── Mini stat ────────────────────────────────────────────────────────────────

function MiniStat({ label, value, color = C.grey1 }: { label: string; value: string; color?: string }) {
  return (
    <View style={[styles.card, styles.col]}>
      <Text style={{ fontSize: 7, color: C.grey3, marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color }}>{value}</Text>
    </View>
  );
}

// ── Dimension bar chart ───────────────────────────────────────────────────────

function DimensionChart({ dims }: { dims: AuditDimensionScores }) {
  const keys = Object.keys(dims) as Array<keyof AuditDimensionScores>;
  const labelW = 138;
  const wgtW   = 22;
  const scoreW = 24;
  const gapW   = 6;
  const barW   = PAGE_W - labelW - wgtW - scoreW - gapW * 2;
  const rowH   = 18;
  const barH   = 9;
  const totalH = keys.length * rowH + 2;

  return (
    <Svg width={PAGE_W} height={totalH} viewBox={`0 0 ${PAGE_W} ${totalH}`}>
      {keys.map((k, i) => {
        const s   = dims[k].score;
        const wgt = DIMENSION_WEIGHTS[k];
        const col = sc(s);
        const bw  = (s / 100) * barW;
        const y   = i * rowH;
        const by  = y + (rowH - barH) / 2;
        const xBar = labelW + wgtW + gapW;

        return (
          <G key={k}>
            {/* Row background (zebra) */}
            {i % 2 === 0 && (
              <Rect x={0} y={y} width={PAGE_W} height={rowH} fill="#0f0f0f" />
            )}
            {/* Label */}
            <SvgText x={2} y={y + 12} fill={C.grey1} fontSize={8} fontFamily="Helvetica">
              {DIMENSION_LABELS[k]}
            </SvgText>
            {/* Weight */}
            {wgt != null && (
              <SvgText x={labelW + wgtW - 2} y={y + 12} fill={C.grey4} fontSize={7}
                fontFamily="Helvetica" textAnchor="end">
                {Math.round(wgt * 100)}%
              </SvgText>
            )}
            {/* Background bar */}
            <Rect x={xBar} y={by} width={barW} height={barH} fill="#1f1f1f" rx={3} />
            {/* Filled bar */}
            {bw > 0 && (
              <Rect x={xBar} y={by} width={bw} height={barH} fill={col} rx={3} />
            )}
            {/* Score */}
            <SvgText x={xBar + barW + gapW} y={y + 12} fill="white" fontSize={9} fontFamily="Helvetica-Bold">
              {String(s)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ── Activity bar chart ────────────────────────────────────────────────────────

function ActivityChart({ hourly }: { hourly: number[] }) {
  const max       = Math.max(...hourly, 1);
  const peakThr   = max * 0.65;
  const H         = 52;
  const bw        = Math.floor((PAGE_W - 1) / 24) - 1;
  const maxBH     = H - 2;

  return (
    <Svg width={PAGE_W} height={H + 16} viewBox={`0 0 ${PAGE_W} ${H + 16}`}>
      {/* Baseline */}
      <Line x1={0} y1={H} x2={PAGE_W} y2={H} stroke={C.border} strokeWidth={1} />
      {hourly.map((count, hr) => {
        const bh   = count > 0 ? Math.max((count / max) * maxBH, 2) : 1;
        const fill = count === 0 ? "#111" : count >= peakThr ? C.accent : C.good;
        const x    = hr * (bw + 1);
        return <Rect key={hr} x={x} y={H - bh} width={bw} height={bh} fill={fill} rx={1} />;
      })}
      {/* Hour labels */}
      {[0, 6, 12, 18, 23].map((hr) => (
        <SvgText key={hr} x={hr * (bw + 1)} y={H + 12} fill={C.grey3} fontSize={7} fontFamily="Helvetica">
          {hr === 0 ? "12am" : hr === 12 ? "12pm" : hr === 23 ? "11pm" : `${hr}am`}
        </SvgText>
      ))}
    </Svg>
  );
}

// ── Main document ─────────────────────────────────────────────────────────────

interface AuditForPdf {
  id: string;
  window_days: number;
  overall_score: number | null;
  dimension_scores: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

export default function AuditPdfDocument({
  audit, clientName,
}: {
  audit: AuditForPdf;
  clientName: string;
}) {
  const dims    = audit.dimension_scores as AuditDimensionScores | null;
  const score   = audit.overall_score ?? 0;
  const m       = audit.metrics as Record<string, unknown> | null;
  const ctwa    = m?.ctwaMetrics as import("@/types/ctwa").CTWAMetrics | undefined;
  const rar     = m?.revenueAtRisk as RevenueAtRisk | undefined;
  const hourly  = m?.hourlyActivity as number[] | undefined;
  const chatCount       = (m?.chatCount as number | undefined) ?? 0;
  const intentCount     = (m?.bookingIntentCount as number | undefined) ?? 0;
  const confirmedCount  = (m?.confirmedCount as number | undefined) ?? 0;
  const ghostCount      = (m?.businessGhostCount as number | undefined) ?? 0;
  const answerDim       = dims?.answerRate;
  const answerRate      = answerDim
    ? `${(answerDim.score)}%`
    : "—";
  const speedDim        = dims?.responseSpeed;

  const dateStr = audit.completed_at
    ? new Date(audit.completed_at).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  return (
    <Document>

      {/* ═══════════════════════════════ PAGE 1 ═══════════════════════════════ */}
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 14 }}>
          {/* Orange accent bar */}
          <View style={{ width: 3, backgroundColor: C.accent, marginRight: 10, borderRadius: 2, alignSelf: "stretch" }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: C.white, marginBottom: 2 }}>
              {clientName}
            </Text>
            <Text style={{ fontSize: 9, color: C.grey2 }}>
              WhatsApp Business Audit  ·  {audit.window_days}-day window  ·  {dateStr}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 7, color: C.grey3 }}>G6 LABS ASIA</Text>
            <Text style={{ fontSize: 7, color: C.grey4 }}>Audit {audit.id.slice(0, 8)}</Text>
          </View>
        </View>

        {/* ── Revenue at Risk ── */}
        {rar && rar.lostLeadPool > 0 && (
          <View style={styles.rarCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
              <View>
                <Text style={{ fontSize: 7, color: C.accent, marginBottom: 4 }}>⚠ REVENUE AT RISK</Text>
                <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: C.white, marginBottom: 3 }}>
                  RM {rar.low.toLocaleString()}  –  RM {rar.high.toLocaleString()}
                </Text>
                <Text style={{ fontSize: 8, color: C.grey2 }}>{rar.math}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <View style={{ backgroundColor: "#1f0700", borderRadius: 4, padding: 8, alignItems: "center", minWidth: 64 }}>
                  <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: C.white }}>{rar.lostLeadPool}</Text>
                  <Text style={{ fontSize: 6, color: C.grey3 }}>LOST LEADS</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Score ring + KPI cards ── */}
        <View style={[styles.row, styles.mb12]}>
          {/* Score ring */}
          <View style={[styles.card, { alignItems: "center", justifyContent: "center", padding: 8, width: 136 }]}>
            <ScoreRing score={score} size={120} />
          </View>

          {/* 3 KPI cards stacked 2+2 */}
          <View style={{ flex: 1, gap: 8 }}>
            <View style={styles.row}>
              <KpiCard
                label="Answer Rate"
                value={answerRate}
                color={answerDim ? sc(answerDim.score) : C.grey1}
                sub={`${chatCount} conversations`}
              />
              <KpiCard
                label="Response Speed"
                value={speedDim ? (speedDim.score >= 70 ? "Fast" : speedDim.score >= 40 ? "Moderate" : "Slow") : "—"}
                color={speedDim ? sc(speedDim.score) : C.grey1}
                sub={speedDim?.businessImpact?.split("—")[0]?.trim().slice(0, 28)}
              />
            </View>
            <View style={styles.row}>
              <KpiCard
                label="Booking Intent"
                value={String(intentCount)}
                color={C.warning}
                sub={`${confirmedCount} confirmed`}
              />
              <KpiCard
                label="Ghosted / Lost"
                value={String(ghostCount)}
                color={ghostCount > 10 ? C.critical : ghostCount > 3 ? C.warning : C.good}
                sub="no business follow-up"
              />
            </View>
          </View>
        </View>

        {/* ── Lead conversion stats row ── */}
        {intentCount > 0 && (
          <View style={[styles.mb12]}>
            <Text style={styles.sectionTitle}>LEAD CONVERSION FUNNEL</Text>
            <View style={styles.row}>
              <MiniStat label="Inbound Chats" value={String(m?.inboundChats as number ?? chatCount)} />
              <MiniStat label="Showed Booking Intent" value={String(intentCount)} color={C.warning} />
              <MiniStat label="Confirmed (gave number)" value={String(confirmedCount)} color={C.good} />
              <MiniStat
                label="Close Rate"
                value={intentCount > 0 ? `${((confirmedCount / intentCount) * 100).toFixed(0)}%` : "—"}
                color={confirmedCount / intentCount >= 0.3 ? C.good : C.warning}
              />
            </View>
          </View>
        )}

        {/* ── Drop-off breakdown ── */}
        {ghostCount > 0 && (
          <View style={styles.mb12}>
            <Text style={styles.sectionTitle}>DROP-OFF ANALYSIS</Text>
            <View style={styles.row}>
              <MiniStat label="Ghosted at Greeting" value={String((m?.dropoffByStage as Record<string, number> | undefined)?.greeting ?? 0)} color={C.grey2} />
              <MiniStat label="After Price Inquiry" value={String(m?.priceDropoffCount as number ?? 0)} color={C.warning} />
              <MiniStat label="After Booking Intent" value={String(m?.postIntentDropoffCount as number ?? 0)} color={C.critical} />
              <MiniStat label="Had Prior Reply" value={String(m?.engagedThenGhostedCount as number ?? 0)} color={C.critical} />
            </View>
          </View>
        )}

        {/* ── CTWA ── */}
        {ctwa && ctwa.totalCTWAConversations > 0 && (
          <View style={styles.mb12}>
            <Text style={styles.sectionTitle}>PAID ADS PERFORMANCE (CTWA)</Text>
            <View style={styles.row}>
              <MiniStat label="Ad-Driven Convos" value={String(ctwa.totalCTWAConversations)} />
              <MiniStat
                label="Answered Rate"
                value={`${(ctwa.answeredPaidLeadRate * 100).toFixed(0)}%`}
                color={ctwa.answeredPaidLeadRate >= 0.8 ? C.good : C.warning}
              />
              <MiniStat
                label="Est. Wasted Spend"
                value={`RM ${ctwa.wastedSpendEstimate.toFixed(0)}`}
                color={C.critical}
              />
              <MiniStat
                label="Cost / Answered Lead"
                value={ctwa.costPerAnsweredConversation
                  ? `RM ${ctwa.costPerAnsweredConversation.toFixed(0)}`
                  : "—"
                }
              />
            </View>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={styles.footerLine} />
        <View style={styles.footer}>
          <Text>G6 Labs Asia  ·  Build smarter. Scale faster.</Text>
          <Text>Generated {new Date().toLocaleDateString("en-MY")}</Text>
        </View>
      </Page>

      {/* ═══════════════════════════════ PAGE 2 ═══════════════════════════════ */}
      <Page size="A4" style={styles.page}>

        {/* Mini header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: C.white }}>{clientName}</Text>
          <Text style={{ fontSize: 8, color: C.grey3 }}>Dimension Scores  ·  {dateStr}</Text>
        </View>

        {/* ── Dimension bar chart ── */}
        {dims && (
          <View style={styles.mb16}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={styles.sectionTitle}>PERFORMANCE BY DIMENSION</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {([["Good ≥75", C.good], ["Warning ≥50", C.warning], ["Critical <50", C.critical]] as [string,string][]).map(([l, c]) => (
                  <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Svg width={8} height={8}><Rect x={0} y={0} width={8} height={8} fill={c} rx={2} /></Svg>
                    <Text style={{ fontSize: 6, color: C.grey3 }}>{l}</Text>
                  </View>
                ))}
              </View>
            </View>
            <DimensionChart dims={dims} />
          </View>
        )}

        {/* ── Activity chart ── */}
        {hourly && hourly.some((v) => v > 0) && (
          <View style={styles.mb12}>
            <Text style={[styles.sectionTitle, { marginBottom: 6 }]}>MESSAGE ACTIVITY BY HOUR</Text>
            <Text style={{ fontSize: 7, color: C.grey3, marginBottom: 6 }}>
              When customers message — use peaks to plan staffing and automation triggers
            </Text>
            {/* Legend */}
            <View style={{ flexDirection: "row", gap: 14, marginBottom: 6 }}>
              {([["Peak hours", C.accent], ["Normal hours", C.good]] as [string,string][]).map(([l, c]) => (
                <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Svg width={10} height={8}><Rect x={0} y={0} width={10} height={8} fill={c} rx={1} /></Svg>
                  <Text style={{ fontSize: 7, color: C.grey3 }}>{l}</Text>
                </View>
              ))}
            </View>
            <ActivityChart hourly={hourly} />
          </View>
        )}

        {/* ── Footer ── */}
        <View style={styles.footerLine} />
        <View style={styles.footer}>
          <Text>G6 Labs Asia  ·  Build smarter. Scale faster.</Text>
          <Text>Audit ID: {audit.id.slice(0, 8)}</Text>
        </View>
      </Page>

    </Document>
  );
}
