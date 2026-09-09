"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  applyFiltersFromQuery,
  buildFilterUrl,
  parseDashboardNavigation,
} from "@/lib/dashboard-nav";

type Filters = Record<string, string>;
type FiltersUpdate = Filters | ((prev: Filters) => Filters);

/**
 * URL-synced replacement for a page's local `useState<Record<string,string>>`
 * filter state. Reads its initial value from the current URL (so dashboard
 * drill-down links, refresh, and browser back/forward all work), and every
 * `setFilters` call rewrites the URL via `router.replace` so it stays the
 * single source of truth.
 */
export function useUrlFilters(
  allowedKeys: readonly string[],
  defaults: Filters = {},
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const computeFromUrl = useCallback(
    () => applyFiltersFromQuery(parseDashboardNavigation(searchParams), allowedKeys, defaults),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams],
  );

  const [filters, setFiltersState] = useState<Filters>(computeFromUrl);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Re-sync when the URL changes externally (back/forward navigation, or a
  // drill-down link landing directly on this page).
  useEffect(() => {
    setFiltersState(computeFromUrl());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setFilters = useCallback(
    (update: FiltersUpdate) => {
      const next = typeof update === "function" ? update(filtersRef.current) : update;
      setFiltersState(next);
      router.replace(buildFilterUrl(pathname, next), { scroll: false });
    },
    [pathname, router],
  );

  return [filters, setFilters] as const;
}
