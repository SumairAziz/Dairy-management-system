"use client";

import { useState, useEffect, useMemo, type RefObject, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

export interface PaginationControlsProps {
  /** 1-indexed current page number */
  page: number;
  /** Total number of pages */
  totalPages: number;
  /** Optional total count of records for display (e.g. 150 records) */
  totalRecords?: number;
  /** Optional page size (records per page) */
  pageSize?: number;
  /** Callback fired when page changes */
  onPageChange: (newPage: number) => void;
  /** Optional DOM element ref to scroll into view upon page change */
  scrollTargetRef?: RefObject<HTMLElement | null>;
  /** Optional element ID to scroll into view upon page change */
  containerId?: string;
  /** Additional wrapper classes */
  className?: string;
}

/** Scrolls smoothly to the top of the table/list container upon page change. */
export function scrollToTableTop(
  target?: RefObject<HTMLElement | null> | HTMLElement | string | null,
) {
  if (typeof window === "undefined") return;

  let el: HTMLElement | null = null;
  if (typeof target === "string") {
    el = document.getElementById(target);
  } else if (target && "current" in target) {
    el = target.current;
  } else if (target instanceof HTMLElement) {
    el = target;
  }

  if (!el) {
    // Fallback: search for nearest table or surface card container
    el = document.querySelector("table, [role='grid'], .surface.border");
  }

  if (el) {
    const yOffset = -80; // Offset for sticky navbar
    const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }
}

export function PaginationControls({
  page,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  scrollTargetRef,
  containerId,
  className = "",
}: PaginationControlsProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const [jumpInput, setJumpInput] = useState<string>(String(safePage));

  // Sync jump input with current page prop
  useEffect(() => {
    setJumpInput(String(safePage));
  }, [safePage]);

  const handlePageChange = (newPage: number) => {
    const targetPage = Math.min(Math.max(1, newPage), safeTotalPages);
    if (targetPage !== safePage) {
      onPageChange(targetPage);
      scrollToTableTop(scrollTargetRef || containerId);
    }
  };

  const handleJumpSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpInput.trim(), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= safeTotalPages) {
      handlePageChange(parsed);
    } else {
      setJumpInput(String(safePage));
    }
  };

  // Generate page numbers array with intelligent ellipsis
  const pageNumbers = useMemo(() => {
    if (safeTotalPages <= 7) {
      return Array.from({ length: safeTotalPages }, (_, i) => i + 1);
    }

    const pages: (number | "...")[] = [];
    pages.push(1);

    if (safePage <= 4) {
      pages.push(2, 3, 4, 5, "...", safeTotalPages);
    } else if (safePage >= safeTotalPages - 3) {
      pages.push(
        "...",
        safeTotalPages - 4,
        safeTotalPages - 3,
        safeTotalPages - 2,
        safeTotalPages - 1,
        safeTotalPages,
      );
    } else {
      pages.push("...", safePage - 1, safePage, safePage + 1, "...", safeTotalPages);
    }

    return pages;
  }, [safePage, safeTotalPages]);

  // Compute record range string if totalRecords & pageSize are provided
  const rangeText = useMemo(() => {
    if (totalRecords == null) return null;
    if (totalRecords === 0) return "0 records";
    if (!pageSize) return `${totalRecords} record${totalRecords !== 1 ? "s" : ""}`;

    const start = (safePage - 1) * pageSize + 1;
    const end = Math.min(safePage * pageSize, totalRecords);
    return `${start}–${end} of ${totalRecords} records`;
  }, [safePage, pageSize, totalRecords]);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 text-sm select-none ${className}`}
    >
      {/* Record count summary */}
      <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
        <span>
          Page <strong className="text-foreground font-semibold">{safePage}</strong> of{" "}
          <strong className="text-foreground font-semibold">{safeTotalPages}</strong>
        </span>
        {rangeText && <span className="opacity-70">({rangeText})</span>}
      </div>

      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => handlePageChange(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Previous page"
          title="Previous Page"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg surface border text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
        >
          <ChevronLeft size={14} />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 py-1 text-xs text-muted-foreground opacity-50 select-none"
                >
                  …
                </span>
              );
            }

            const isCurrent = p === safePage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handlePageChange(p)}
                aria-current={isCurrent ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${
                  isCurrent
                    ? "bg-brand-600 text-white font-semibold shadow-sm"
                    : "surface border hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => handlePageChange(safePage + 1)}
          disabled={safePage >= safeTotalPages}
          aria-label="Next page"
          title="Next Page"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg surface border text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={14} />
        </button>

        {/* Jump to page form */}
        {safeTotalPages > 2 && (
          <form
            onSubmit={handleJumpSubmit}
            className="flex items-center gap-1.5 ml-1 pl-2 border-l border-black/10 dark:border-white/10"
          >
            <label htmlFor="jump-page-input" className="sr-only">
              Go to page
            </label>
            <span className="text-xs muted hidden md:inline">Go to:</span>
            <input
              id="jump-page-input"
              type="number"
              min={1}
              max={safeTotalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleJumpSubmit(e);
                }
              }}
              placeholder="Page #"
              className="w-12 h-8 px-1.5 text-center text-xs rounded-lg surface border focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
            />
            <button
              type="submit"
              title="Jump to page"
              aria-label="Jump to page"
              className="h-8 px-2 rounded-lg bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 text-xs font-medium transition-colors"
            >
              <ArrowRight size={12} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
