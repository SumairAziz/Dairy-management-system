"use client";

import Link from "next/link";
import { Navbar } from "@/app/components/navbar";
import { InventoryDashboardOverview } from "@/app/inventory/components/InventoryDashboardOverview";
import { routes } from "@/lib/routes";
import { ArrowDownToLine, ArrowUpFromLine, Plus } from "lucide-react";

export default function InventoryDashboardPage() {
  return (
    <>
      <Navbar title="Inventory Dashboard" subtitle="Stock overview and warehouse health" />
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          <Link
            href={routes.inventoryStockIn}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-white text-sm"
          >
            <ArrowDownToLine size={14} /> Record Stock In
          </Link>
          <Link
            href={routes.inventoryStockOut}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white text-sm"
          >
            <ArrowUpFromLine size={14} /> Record Usage
          </Link>
          <Link
            href={`${routes.inventoryItems}?action=add`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg surface border text-sm"
          >
            <Plus size={14} /> Add Item
          </Link>
        </div>

        <InventoryDashboardOverview />
      </div>
    </>
  );
}
