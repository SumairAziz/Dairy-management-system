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

  Package,

  Syringe,

  Heart,

  Flame,

  Baby,

  Star,

  Sparkles,

  MessageCircle,

  Settings,

} from "lucide-react";

import { routes } from "@/lib/routes";

import { NAV_PERMISSIONS } from "@/lib/rbac/permissions";

import { usePermissions } from "@/hooks/use-permissions";

import {

  TerraDairyBrandText,

  TerraDairyLogoMark,

} from "@/app/components/terra-dairy-brand";



const AUTH_PATHS = ["/login", "/register"];



const links = [

  { href: routes.assistant, label: "AI Assistant", icon: Sparkles },

  { href: routes.dashboard, label: "Dashboard", icon: LayoutDashboard },

  { href: routes.farms, label: "Farms", icon: Building2 },

  { href: routes.units, label: "Units", icon: Boxes },

  { href: routes.speciesBreeds, label: "Species & Breeds", icon: Dna },

  { href: routes.list, label: "Animals", icon: Beef },

  { href: routes.milkProduction, label: "Milk Production", icon: Milk },

  { href: routes.inventory, label: "Inventory", icon: Package },

  { href: routes.vaccinations, label: "Vaccinations", icon: Syringe },

  { href: routes.breeding, label: "Breeding", icon: Heart },

  { href: routes.heatCycles, label: "Heat Cycles", icon: Flame },

  { href: routes.pregnancy, label: "Pregnancy", icon: Baby },

  { href: routes.calving, label: "Calving", icon: Star },

  { href: routes.messages, label: "Messages", icon: MessageCircle },

  { href: routes.settings, label: "Settings", icon: Settings },

];



function isNavActive(pathname: string, href: string): boolean {

  if (href === routes.inventory) {

    return pathname === "/inventory" || pathname.startsWith("/inventory/");

  }

  if (href === routes.list) {

    return pathname === href || pathname.startsWith(`${href}/`);

  }

  if (href === routes.dashboard) {

    return pathname === href;

  }

  if (href === routes.settings) {

    return pathname === routes.settings || pathname.startsWith("/settings/");

  }

  if (href === routes.messages) {

    return pathname === routes.messages || pathname.startsWith(`${routes.messages}/`);

  }

  return pathname === href || pathname.startsWith(`${href}/`);

}



export function Sidebar() {

  const pathname = usePathname();

  const { can, isLoading } = usePermissions();



  if (AUTH_PATHS.includes(pathname)) {

    return null;

  }



  const visibleLinks = links.filter((link) => {

    const permission = NAV_PERMISSIONS[link.href];

    if (!permission) return true;

    if (isLoading) return false;

    return can(permission);

  });



  return (

    <aside className="surface border-r w-60 shrink-0 sticky top-0 h-screen p-4 hidden md:flex flex-col overflow-hidden">

      <Link

        href={routes.dashboard}

        className="group flex items-center gap-2.5 px-2 py-3 -mx-0.5 rounded-xl shrink-0 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"

        aria-label="TerraDairy — go to dashboard"

      >

        <TerraDairyLogoMark />

        <TerraDairyBrandText />

      </Link>

      <nav className="mt-4 space-y-1 flex-1 overflow-y-auto min-h-0">

        {visibleLinks.map((l) => {

          const Icon = l.icon;

          const active = isNavActive(pathname, l.href);

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


