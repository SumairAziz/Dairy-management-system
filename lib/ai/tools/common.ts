import { z } from "zod";

/** `YYYY-MM-DD` date string, validated loosely (Prisma/JS Date parses the rest). */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date in YYYY-MM-DD format");

export const optionalDateStringSchema = dateStringSchema.optional();

export const limitSchema = z.number().int().min(1).max(200).optional();

export function toDate(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

export function endOfDay(s: string): Date {
  return new Date(`${s}T23:59:59.999`);
}

/** Rounds to 1 decimal — matches the precision used throughout the existing services (see milk.service.ts). */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return round1(((current - previous) / previous) * 100);
}
