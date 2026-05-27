import { cn } from "@/lib/utils/format";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 font-body">
          {label}
        </label>
      )}
      <input
        id={id}
        {...props}
        className={cn(
          "w-full rounded-md border border-g6-border bg-g6-surface px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-g6-accent focus:outline-none focus:ring-1 focus:ring-g6-accent",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500",
          className
        )}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
