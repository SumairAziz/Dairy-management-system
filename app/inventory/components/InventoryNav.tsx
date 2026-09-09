"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  CalendarClock,
  Truck,
  History,
  SlidersHorizontal,
} from "lucide-react";
import { routes } from "@/lib/routes";

const NAV_ITEMS = [
  { href: routes.inventoryDashboard, label: "Dashboard", icon: LayoutDashboard },
  { href: routes.inventoryItems, label: "Items", icon: Package },
  { href: routes.inventoryStockIn, label: "Stock In", icon: ArrowDownToLine },
  { href: routes.inventoryStockOut, label: "Usage", icon: ArrowUpFromLine },
  { href: routes.inventoryAdjustments, label: "Adjustments", icon: SlidersHorizontal },
  { href: routes.inventoryTransactions, label: "Transactions", icon: History },
  { href: routes.inventoryLowStock, label: "Low Stock", icon: AlertTriangle },
  { href: routes.inventoryExpiring, label: "Expiring", icon: CalendarClock },
  { href: routes.inventorySuppliers, label: "Suppliers", icon: Truck },
] as const;

function isActive(pathname: string, href: string) {
  if (href === routes.inventoryDashboard) {
    return pathname === href || pathname === routes.inventory;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function InventoryNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-black/5 dark:border-white/10 bg-indigo-500/[0.03]">
      <div className="px-6 pt-4 pb-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
            <Package size={16} className="text-indigo-400" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-indigo-400/80 font-semibold">
              Module
            </div>
            <div className="font-semibold text-sm">Inventory Management</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-px -mx-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? "border-indigo-500 text-indigo-300 font-medium"
                    : "border-transparent muted hover:text-foreground hover:border-white/10"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
