interface ProgressBarProps {
  pct: number;
  label?: string;
}

export default function ProgressBar({ pct, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="space-y-1">
      {label && <p className="text-sm text-gray-400 font-body">{label}</p>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-g6-border">
        <div
          className="h-full rounded-full bg-g6-accent transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-right text-xs text-gray-500">{clamped}%</p>
    </div>
  );
}
