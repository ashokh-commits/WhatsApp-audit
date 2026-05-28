"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard",   label: "Dashboard", icon: "⊞" },
  { href: "/clients/new", label: "Add Client", icon: "＋" },
  { href: "/ctwa/import", label: "Import Ads", icon: "↑" },
  { href: "/api/health",  label: "Health",     icon: "♥" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-g6-border bg-g6-surface md:hidden">
      {navItems.map(({ href, label, icon }) => {
        const active = pathname.startsWith(href) && href !== "/api/health";
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              active
                ? "text-g6-accent"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <span className="text-lg leading-none">{icon}</span>
            <span className="font-body">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
