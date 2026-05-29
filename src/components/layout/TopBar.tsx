import LogoutButton from "@/components/auth/LogoutButton";

interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  return (
    <header className="relative flex h-16 items-center justify-between bg-[#0A0A0A] px-6">
      {/* Orange accent line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-g6-accent/60 via-g6-border to-transparent" />
      <h1 className="font-heading text-lg font-semibold text-white">{title}</h1>
      <LogoutButton />
    </header>
  );
}
