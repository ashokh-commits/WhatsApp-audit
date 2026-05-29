"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

interface Props {
  clientId: string;
  windowDays: number;
}

export default function RetryAuditButton({ clientId, windowDays }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRetry() {
    setLoading(true);
    try {
      const res = await fetch("/api/audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, windowDays }),
      });
      const data = await res.json() as { auditId?: string; error?: string };
      if (data.auditId) {
        router.push(`/audit/${data.auditId}`);
      } else {
        alert(data.error ?? "Failed to start audit");
        setLoading(false);
      }
    } catch {
      alert("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <Button size="sm" loading={loading} onClick={handleRetry}>
      Re-run Audit
    </Button>
  );
}
