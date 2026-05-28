import { cn } from "@/lib/utils/format";
import type { DimensionStatus } from "@/types/scoring";

interface BadgeProps {
  status: DimensionStatus | "good" | "warning" | "critical" | "pending" | "running" | "complete" | "failed";
  label?: string;
  className?: string;
}

const statusColors: Record<string, string> = {
  good:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  warning:  "bg-orange-500/15 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  pending:  "bg-gray-500/15 text-gray-400 border-gray-500/30",
  running:  "bg-g6-accent/15 text-g6-accent border-g6-accent/30",
  complete: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed:   "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function Badge({ status, label, className }: BadgeProps) {
  const displayLabel = label ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        statusColors[status] ?? statusColors.pending,
        className
      )}
    >
      {displayLabel}
    </span>
  );
}
