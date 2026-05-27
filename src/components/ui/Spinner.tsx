import { cn } from "@/lib/utils/format";

export default function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-g6-accent border-t-transparent",
        className
      )}
      aria-label="Loading"
    />
  );
}
