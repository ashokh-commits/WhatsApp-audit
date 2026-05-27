"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ProgressBar from "@/components/ui/ProgressBar";

interface Props {
  auditId: string;
  initialProgress?: Record<string, unknown>;
}

const MAX_POLLS = 120;

export default function AuditProgressModal({ auditId, initialProgress }: Props) {
  const router = useRouter();
  const [progress, setProgress] = useState({
    pct: (initialProgress?.pct as number) ?? 0,
    stageLabel: (initialProgress?.stageLabel as string) ?? "Waiting to start...",
  });
  const [polls, setPolls] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/audit/status/${auditId}`);
      const data = await res.json() as {
        status: string;
        progress?: { pct?: number; stageLabel?: string };
        errorMessage?: string;
      };

      if (data.status === "complete") {
        router.refresh();
        return;
      }

      if (data.status === "failed") {
        router.refresh();
        return;
      }

      if (data.progress) {
        setProgress({
          pct: data.progress.pct ?? 0,
          stageLabel: data.progress.stageLabel ?? "Processing...",
        });
      }
    } catch {
      // Network error — keep polling
    }
  }, [auditId, router]);

  useEffect(() => {
    if (polls >= MAX_POLLS) {
      setTimedOut(true);
      return;
    }

    const timer = setTimeout(async () => {
      await poll();
      setPolls((p) => p + 1);
    }, 3000);

    return () => clearTimeout(timer);
  }, [polls, poll]);

  return (
    <div className="mb-6 rounded-xl border border-g6-border bg-g6-card p-6 space-y-4">
      <h2 className="font-heading text-white font-semibold">Audit in progress</h2>
      <ProgressBar pct={progress.pct} label={progress.stageLabel} />
      {timedOut && (
        <p className="font-body text-sm text-amber-400">
          This audit is taking longer than expected. It may complete in the background.{" "}
          <button
            onClick={() => router.refresh()}
            className="underline text-g6-accent"
          >
            Refresh
          </button>
        </p>
      )}
    </div>
  );
}
