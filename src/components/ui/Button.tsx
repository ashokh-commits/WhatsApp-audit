"use client";

import { cn } from "@/lib/utils/format";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-g6-accent to-g6-orange text-white hover:opacity-90 shadow-orange active:scale-95",
  secondary:
    "bg-transparent border border-g6-border text-gray-300 hover:border-g6-accent hover:text-g6-accent",
  danger:
    "bg-gradient-to-r from-red-700 to-red-500 text-white hover:opacity-90 active:scale-95",
  ghost: "text-g6-accent hover:bg-g6-card",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-heading font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-g6-accent focus:ring-offset-2 focus:ring-offset-g6-bg disabled:opacity-40 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {loading && (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
