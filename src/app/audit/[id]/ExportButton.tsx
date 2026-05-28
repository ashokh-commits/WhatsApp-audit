"use client";

import Button from "@/components/ui/Button";

interface Props {
  auditId: string;
}

export default function ExportButton({ auditId }: Props) {
  function handleExport() {
    window.open(`/api/audit/pdf/${auditId}`, "_blank");
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleExport}>
      Export PDF
    </Button>
  );
}
