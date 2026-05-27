import LogoutButton from "@/components/auth/LogoutButton";

interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-g6-border bg-g6-surface px-6">
      <h1 className="font-heading text-lg font-semibold text-white">{title}</h1>
      <LogoutButton />
    </header>
  );
}
