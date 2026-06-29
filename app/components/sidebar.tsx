"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Boxes,
  Dna,
  Beef,
  Milk,
  Syringe,
  Heart,
  Flame,
  Baby,
} from "lucide-react";

const AUTH_PATHS = ["/login", "/register"];

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/farms", label: "Farms", icon: Building2 },
  { href: "/units", label: "Units", icon: Boxes },
  { href: "/species-breeds", label: "Species & Breeds", icon: Dna },
  { href: "/animals", label: "Animals", icon: Beef },
  { href: "/milk-production", label: "Milk Production", icon: Milk },
  { href: "/vaccinations", label: "Vaccinations", icon: Syringe },
  { href: "/breeding", label: "Breeding", icon: Heart },
  { href: "/heat-cycles", label: "Heat Cycles", icon: Flame },
  { href: "/pregnancy", label: "Pregnancy", icon: Baby },
];

export function Sidebar() {
  const pathname = usePathname();

  // Hide sidebar entirely on auth pages
  if (AUTH_PATHS.includes(pathname)) {
    return null;
  }

  return (
    <aside className="surface border-r w-60 min-h-screen p-4 hidden md:block">
      <div className="flex items-center gap-2 px-2 py-4">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700" />
        <div>
          <div className="font-semibold tracking-tight">TerraDairy</div>
          <div className="text-xs muted">Smart farm OS</div>
        </div>
      </div>
      <nav className="mt-4 space-y-1">
        {links.map((l) => {
          const Icon = l.icon;
          const active =
            pathname === l.href ||
            (l.href !== "/" && pathname.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-brand-500/15 text-brand-700 dark:text-brand-300 font-medium" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
            >
              <Icon size={16} /> {l.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}