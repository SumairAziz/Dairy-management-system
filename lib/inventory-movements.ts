/** Inventory stock movement types and helpers (single source of truth). */

export const MOVEMENT_STOCK_IN = "Stock In";
export const MOVEMENT_STOCK_OUT = "Stock Out";
export const MOVEMENT_USAGE = "Usage";
export const MOVEMENT_ADJUSTMENT = "Adjustment";
export const MOVEMENT_DAMAGED = "Damaged";
export const MOVEMENT_EXPIRED = "Expired";
export const MOVEMENT_LOST = "Lost";
export const MOVEMENT_RETURN = "Return";
export const MOVEMENT_PHYSICAL_COUNT = "Physical Count";
export const MOVEMENT_GROUP_TREATMENT = "Group Treatment";

export type InventoryMovementType =
  | typeof MOVEMENT_STOCK_IN
  | typeof MOVEMENT_STOCK_OUT
  | typeof MOVEMENT_USAGE
  | typeof MOVEMENT_ADJUSTMENT
  | typeof MOVEMENT_DAMAGED
  | typeof MOVEMENT_EXPIRED
  | typeof MOVEMENT_LOST
  | typeof MOVEMENT_RETURN
  | typeof MOVEMENT_PHYSICAL_COUNT
  | typeof MOVEMENT_GROUP_TREATMENT;

export const ADJUSTMENT_ACTIONS = [
  "adjustment",
  "damaged",
  "expired",
  "lost",
  "return",
  "physical_count",
] as const;

export type AdjustmentAction = (typeof ADJUSTMENT_ACTIONS)[number];

export function adjustmentActionToMovementType(
  action: AdjustmentAction,
  direction?: "in" | "out",
): InventoryMovementType {
  switch (action) {
    case "damaged":
      return MOVEMENT_DAMAGED;
    case "expired":
      return MOVEMENT_EXPIRED;
    case "lost":
      return MOVEMENT_LOST;
    case "return":
      return MOVEMENT_RETURN;
    case "physical_count":
      return MOVEMENT_PHYSICAL_COUNT;
    case "adjustment":
      return MOVEMENT_ADJUSTMENT;
    default:
      return direction === "in" ? MOVEMENT_ADJUSTMENT : MOVEMENT_ADJUSTMENT;
  }
}

export function movementDecreasesStock(type: string): boolean {
  return (
    type === MOVEMENT_STOCK_OUT ||
    type === MOVEMENT_USAGE ||
    type === MOVEMENT_DAMAGED ||
    type === MOVEMENT_EXPIRED ||
    type === MOVEMENT_LOST ||
    type === MOVEMENT_GROUP_TREATMENT
  );
}

export const INBOUND_MOVEMENT_TYPES = [
  MOVEMENT_STOCK_IN,
  MOVEMENT_RETURN,
  MOVEMENT_ADJUSTMENT,
  MOVEMENT_PHYSICAL_COUNT,
] as const;

export type InboundMovementType = (typeof INBOUND_MOVEMENT_TYPES)[number];
