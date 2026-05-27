"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface Client {
  id: string;
  name: string;
  instance_name: string;
  created_at: string;
  lastAudit: {
    id: string;
    overall_score: number | null;
    status: string;
    created_at: string;
  } | null;
  hasConsent: boolean;
}

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;
  const color =
    score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#2A2D36" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute font-heading text-lg font-bold text-white">
        {score}
      </span>
    </div>
  );
}

export default function ClientCard({ client }: { client: Client }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [windowDays, setWindowDays] = useState(90);

  async function handleRunAudit() {
    if (!client.hasConsent) {
      router.push(`/consent/${client.id}`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, windowDays }),
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
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-heading font-semibold text-white">{client.name}</h3>
          <p className="font-body text-xs text-gray-400">{client.instance_name}</p>
        </div>
        {client.lastAudit?.overall_score != null && (
          <ScoreRing score={client.lastAudit.overall_score} />
        )}
      </div>

      {client.lastAudit && (
        <div className="flex items-center gap-2">
          <Badge status={client.lastAudit.status as "pending" | "running" | "complete" | "failed"} />
          <span className="font-body text-xs text-gray-500">
            {new Date(client.lastAudit.created_at).toLocaleDateString()}
          </span>
          {client.lastAudit.status === "complete" && (
            <Link
              href={`/audit/${client.lastAudit.id}`}
              className="ml-auto font-body text-xs text-g6-accent hover:underline"
            >
              View report →
            </Link>
          )}
        </div>
      )}

      {!client.hasConsent && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-400 border border-amber-500/20 font-body">
          Consent required before audit can run.
        </p>
      )}

      <div className="flex items-center gap-2">
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          className="rounded border border-g6-border bg-g6-surface px-2 py-1.5 text-xs text-white focus:outline-none"
        >
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
          <option value={90}>90 days</option>
        </select>
        <Button
          size="sm"
          loading={loading}
          onClick={handleRunAudit}
          className="flex-1"
        >
          {client.hasConsent ? "Run Audit" : "Record Consent"}
        </Button>
      </div>
    </Card>
  );
}
