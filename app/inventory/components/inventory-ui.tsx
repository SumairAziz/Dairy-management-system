"use client";

import Link from "next/link";
import {
  expiryStatusLabel,
  stockStatusLabel,
  stockStatusTone,
  type ExpiryStatus,
  type StockStatus,
} from "@/lib/inventory-status";
import { TONE } from "@/lib/theme";
import { routes } from "@/lib/routes";
import type { InventoryItem } from "@/types";

export function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const tone = stockStatusTone(status);
  const style = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {stockStatusLabel(status)}
    </span>
  );
}

export function ExpiryStatusBadge({ status }: { status: ExpiryStatus }) {
  const label = expiryStatusLabel(status);
  if (!label) return null;
  const tone = status === "expired" ? "danger" : "warning";
  const style = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.cls}`}
    >
      {label}
    </span>
  );
}

export function ItemLink({
  id,
  name,
  className = "",
}: {
  id: number;
  name: string;
  className?: string;
}) {
  return (
    <Link
      href={routes.inventoryItemDetail(id)}
      className={`font-medium hover:text-indigo-400 transition-colors ${className}`}
    >
      {name}
    </Link>
  );
}

export function WorkflowCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface border rounded-2xl p-6 max-w-2xl">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="text-sm muted mt-1 mb-5">{description}</p>}
      {!description && <div className="mb-5" />}
      {children}
    </div>
  );
}

export function itemSelectLabel(item: InventoryItem) {
  return `${item.item_name} · ${item.quantity} ${item.unit}`;
}
