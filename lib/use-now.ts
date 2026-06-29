"use client";
import { useEffect, useState } from "react";

/**
 * Returns the current Date, refreshed every `intervalMs` (default 60s).
 * Lets any "Overdue"/"Due Today"/etc. status computed from `now` stay
 * correct on a long-open tab as midnight passes, with no polling of the
 * server and no scheduled job involved.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
