import Link from "next/link";
import Image from "next/image";

const navItems = [
  { href: "/dashboard",    label: "Dashboard" },
  { href: "/clients/new",  label: "Add Client" },
  { href: "/ctwa/import",  label: "Import Ads" },
  { href: "/api/health",   label: "API Health" },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex h-screen w-56 flex-col border-r border-g6-border bg-g6-surface">
      <div className="flex h-16 items-center border-b border-g6-border px-4">
        {/* Replace with actual G6-White.png once available */}
        <Image
          src="/G6-White.png"
          alt="G6 Labs"
          width={80}
          height={32}
          className="object-contain"
          priority
        />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center rounded-md px-3 py-2 text-sm font-body text-gray-300 transition-colors hover:bg-g6-card hover:text-white"
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
