// Shared helpers for ERP-style drill-down navigation: dashboard cards/charts
// build a filtered URL to a list page; list pages parse that URL back into
// their filter state. Single source of truth so no page reinvents either
// direction of this conversion.

type FilterValue = string | number | boolean | null | undefined;

/** Builds `path?k=v&...`, dropping empty/null/undefined values. Encodes via URLSearchParams. */
export function buildFilterUrl(
  path: string,
  params: Record<string, FilterValue>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const str = String(value);
    if (str === "") continue;
    qs.set(key, str);
  }
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

/** Flattens a URLSearchParams-like object into a plain string record. */
export function parseDashboardNavigation(
  searchParams: URLSearchParams | { entries(): IterableIterator<[string, string]> },
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (value !== "") result[key] = value;
  }
  return result;
}

/** Whitelists a parsed query object down to a page's known filter keys, applying defaults for any missing. */
export function applyFiltersFromQuery(
  parsed: Record<string, string>,
  allowedKeys: readonly string[],
  defaults: Record<string, string> = {},
): Record<string, string> {
  const result: Record<string, string> = { ...defaults };
  for (const key of allowedKeys) {
    if (parsed[key] !== undefined) result[key] = parsed[key];
  }
  return result;
}
