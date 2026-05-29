"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard",   label: "Dashboard" },
  { href: "/clients/new", label: "Add Client" },
  { href: "/ctwa/import", label: "Import Ads" },
  { href: "/api/health",  label: "API Health" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex h-screen w-56 flex-col border-r border-g6-border bg-[#0A0A0A]">
      <div className="flex h-16 items-center border-b border-g6-border px-4 gap-2">
        {/* G6-White.png — add file to /public to replace this text logo */}
        <span className="font-heading text-lg font-bold text-white leading-none">G6</span>
        <span className="font-body text-sm text-g6-accent font-semibold leading-none">Labs</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {navItems.map(({ href, label }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={
                active
                  ? "flex items-center rounded-lg px-3 py-2.5 text-sm font-body transition-colors bg-g6-card text-white border-l-2 border-g6-accent pl-[10px]"
                  : "flex items-center rounded-lg px-3 py-2.5 text-sm font-body transition-colors text-gray-400 hover:bg-g6-card hover:text-white"
              }
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-g6-border px-4 py-3">
        <p className="font-body text-[10px] text-gray-600 leading-snug">
          Build smarter.<br />Scale faster.
        </p>
      </div>
    </aside>
  );
}
