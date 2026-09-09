"use client";

import { Navbar } from "@/app/components/navbar";
import { useInventory, useUrlFilters } from "@/hooks";
import { InventoryItemsTable } from "@/app/inventory/components/InventoryItemsTable";
import { routes } from "@/lib/routes";
import { CalendarClock } from "lucide-react";

const FILTER_KEYS = ["tab", "days"] as const;

export default function ExpiringPage() {
  const [filters, setFilters] = useUrlFilters(FILTER_KEYS, { tab: "soon", days: "30" });
  const tab = filters.tab === "expired" ? "expired" : "soon";
  const days = filters.days === "7" || filters.days === "90" ? filters.days : "30";

  const { data: expiringData, isLoading: loadingSoon } = useInventory({
    pageSize: "500",
    expiry_days: days,
    sort_by: "expiry_date",
    sort_order: "asc",
  });

  const { data: expiredData, isLoading: loadingExpired } = useInventory({
    pageSize: "500",
    expiry_status: "expired",
    sort_by: "expiry_date",
    sort_order: "asc",
  });

  const items = tab === "expired" ? (expiredData?.data ?? []) : (expiringData?.data ?? []);
  const isLoading = tab === "expired" ? loadingExpired : loadingSoon;
  const total = tab === "expired" ? expiredData?.total : expiringData?.total;

  return (
    <>
      <Navbar
        title="Expiring & Expired"
        subtitle="Time-sensitive medicines, vaccines, and perishables"
      />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilters({ tab: "soon", days })}
            className={`px-4 py-2 rounded-xl text-sm border transition-colors ${
              tab === "soon"
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300 font-medium"
                : "surface border-transparent muted"
            }`}
          >
            Expiring Soon ({expiringData?.total ?? 0})
          </button>
          <button
            onClick={() => setFilters({ tab: "expired", days: "" })}
            className={`px-4 py-2 rounded-xl text-sm border transition-colors ${
              tab === "expired"
                ? "bg-red-500/15 border-red-500/40 text-red-300 font-medium"
                : "surface border-transparent muted"
            }`}
          >
            Expired ({expiredData?.total ?? 0})
          </button>
        </div>

        {tab === "soon" && (
          <div className="flex flex-wrap gap-2">
            {(["7", "30", "90"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setFilters({ tab: "soon", days: d })}
                className={`px-3 py-1.5 rounded-lg text-xs border ${
                  days === d
                    ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300"
                    : "surface muted"
                }`}
              >
                Within {d} days
              </button>
            ))}
          </div>
        )}

        <div
          className={`surface border rounded-2xl p-4 flex items-center gap-2 text-sm ${
            tab === "expired" ? "border-red-500/25" : "border-amber-500/25"
          }`}
        >
          <CalendarClock
            size={16}
            className={tab === "expired" ? "text-red-400" : "text-amber-400"}
          />
          <span>
            {tab === "expired"
              ? `${total ?? 0} expired item(s) — do not use.`
              : `${total ?? 0} item(s) expiring within ${days} days.`}
          </span>
        </div>

        <InventoryItemsTable
          items={items}
          isLoading={isLoading}
          emptyMessage={
            tab === "expired"
              ? "No expired items in inventory."
              : `No items expiring within ${days} days.`
          }
          showView
        />
      </div>
    </>
  );
}
