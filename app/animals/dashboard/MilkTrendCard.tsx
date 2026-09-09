"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, TrendingUp } from "lucide-react";
import { LineChart } from "@/app/components/custom-charts";
import { buildFilterUrl } from "@/lib/dashboard-nav";
import {
  DEFAULT_MILK_TREND_PERIOD,
  MILK_TREND_PERIOD_OPTIONS,
  isMilkTrendPeriodId,
  type MilkTrendPeriodId,
} from "@/lib/dashboard-milk-trend";
import { useDashboardMilkTrend } from "@/hooks/use-dashboard";

const STORAGE_KEY = "terradairy.dashboard.milkTrendPeriod";

function readStoredPeriod(): MilkTrendPeriodId {
  if (typeof window === "undefined") return DEFAULT_MILK_TREND_PERIOD;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored && isMilkTrendPeriodId(stored) ? stored : DEFAULT_MILK_TREND_PERIOD;
}

type TrendPoint = {
  label: string;
  value: number;
  date: string;
  date_from?: string;
  date_to?: string;
};

export function MilkTrendCard({
  initialPoints,
  initialTotalLiters,
}: {
  initialPoints?: TrendPoint[];
  initialTotalLiters?: number;
}) {
  const [period, setPeriod] = useState<MilkTrendPeriodId>(readStoredPeriod);

  const handlePeriodChange = (next: MilkTrendPeriodId) => {
    setPeriod(next);
    sessionStorage.setItem(STORAGE_KEY, next);
  };

  const { data, isLoading, isFetching } = useDashboardMilkTrend(period);

  const canUseInitial =
    period === DEFAULT_MILK_TREND_PERIOD && !data && Boolean(initialPoints?.length);
  const points = data?.points ?? (canUseInitial ? initialPoints! : []);
  const totalLiters =
    data?.totalLiters ?? (canUseInitial ? initialTotalLiters : undefined) ?? 0;
  const periodLabel =
    data?.periodLabel ??
    MILK_TREND_PERIOD_OPTIONS.find((option) => option.id === period)?.label ??
    "Last 14 Days";
  const showLoading = (isLoading || isFetching) && points.length === 0;

  const chartData = useMemo(
    () =>
      points.map((point) => ({
        label: point.label,
        value: point.value,
        href: buildFilterUrl("/animals/milk-production", {
          date_from: point.date_from ?? point.date,
          date_to: point.date_to ?? point.date,
        }),
      })),
    [points],
  );

  return (
    <div className="surface border rounded-2xl p-5 lg:col-span-2">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <TrendingUp size={15} className="muted" />
          Milk Production Trend
        </h3>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <label className="flex items-center gap-1.5 text-xs muted">
            <span>Period</span>
            <select
              value={period}
              onChange={(event) => handlePeriodChange(event.target.value as MilkTrendPeriodId)}
              className="min-w-[10.5rem] max-w-full rounded-lg border bg-transparent px-2 py-1.5 text-xs text-foreground"
              aria-label="Milk production trend period"
            >
              {MILK_TREND_PERIOD_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Link
            href="/animals/milk-production"
            className="text-xs muted hover:opacity-80 flex items-center gap-1 whitespace-nowrap"
          >
            View all <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      <p className="text-xs muted mb-3">
        Total:{" "}
        <span className="font-medium text-foreground tabular-nums">
          {totalLiters.toLocaleString(undefined, { maximumFractionDigits: 1 })} L
        </span>
        <span className="mx-1.5">·</span>
        {periodLabel}
        {isFetching && points.length > 0 ? (
          <Loader2 size={12} className="inline ml-2 animate-spin opacity-60" aria-hidden />
        ) : null}
      </p>

      {showLoading ? (
        <div className="flex h-[240px] items-center justify-center gap-2 text-sm muted">
          <Loader2 size={16} className="animate-spin" />
          Loading trend…
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex h-[240px] items-center justify-center text-sm muted">
          No milk production data for this period.
        </div>
      ) : (
        <LineChart
          data={chartData}
          height={240}
          yLabel="L"
          color="#0ea5e9"
          colorFrom="#0369a1"
          colorTo="#38bdf8"
        />
      )}
    </div>
  );
}
