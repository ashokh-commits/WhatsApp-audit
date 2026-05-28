import { cn } from "@/lib/utils/format";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-g6-border bg-g6-card p-5 shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: CardProps) {
  return (
    <h2
      className={cn(
        "font-heading text-base font-semibold text-white",
        className
      )}
    >
      {children}
    </h2>
  );
}
