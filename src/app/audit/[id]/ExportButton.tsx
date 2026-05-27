"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import type { AuditDimensionScores } from "@/types/scoring";
import type { AuditMetrics } from "@/types/audit";
import { DIMENSION_LABELS, DIMENSION_WEIGHTS } from "@/types/scoring";

interface AuditForExport {
  id: string;
  window_days: number;
  overall_score: number | null;
  dimension_scores: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

interface Props {
  audit: AuditForExport;
  clientName: string;
}

export default function ExportButton({ audit, clientName }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: AuditPdfDocument } = await import(
        "@/components/pdf/AuditPdfDocument"
      );

      const blob = await pdf(
        <AuditPdfDocument audit={audit} clientName={clientName} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `g6-audit-${clientName.replace(/\s+/g, "-").toLowerCase()}-${audit.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" loading={loading} onClick={handleExport}>
      Export PDF
    </Button>
  );
}
