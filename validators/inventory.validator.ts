import { z } from "zod";
import { INVENTORY_CATEGORIES } from "@/lib/inventory-status";
import { ADJUSTMENT_ACTIONS } from "@/lib/inventory-movements";

export const inventoryCategorySchema = z.enum(INVENTORY_CATEGORIES);

export const createInventoryItemSchema = z.object({
  farm_id: z.number().int().positive().nullable().optional(),
  item_name: z.string().min(1, "Item name is required").max(150),
  category: inventoryCategorySchema,
  quantity: z.number().min(0).default(0),
  unit: z.string().min(1, "Unit is required").max(30),
  reorder_level: z.number().min(0).nullable().optional(),
  unit_cost: z.number().min(0).nullable().optional(),
  supplier: z.string().max(150).nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

export const updateInventoryItemSchema = createInventoryItemSchema.partial();

export const inventoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  stock_status: z.enum(["in_stock", "low_stock", "out_of_stock"]).optional(),
  supplier: z.string().optional(),
  expiry_status: z.enum(["expired", "expiring_soon", "expiring", "ok", "none"]).optional(),
  expiry_days: z.coerce.number().int().positive().optional(),
  farm_id: z.coerce.number().int().positive().optional(),
  is_active: z.enum(["true", "false"]).optional(),
  sort_by: z
    .enum(["item_name", "category", "quantity", "expiry_date", "unit_cost"])
    .optional()
    .default("item_name"),
  sort_order: z.enum(["asc", "desc"]).optional().default("asc"),
});

export const stockMovementSchema = z.object({
  quantity: z.number().positive("Quantity must be positive"),
  transaction_date: z.string().min(1, "Date is required"),
  notes: z.string().nullable().optional(),
});

export const stockInSchema = stockMovementSchema.extend({
  unit_cost: z.number().min(0).nullable().optional(),
  supplier: z.string().max(150).nullable().optional(),
  lot_number: z.string().max(80).nullable().optional(),
  manufacturing_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  reference: z.string().max(255).nullable().optional(),
});

export const stockAdjustmentSchema = z
  .object({
    action: z.enum(ADJUSTMENT_ACTIONS),
    direction: z.enum(["in", "out"]).optional(),
    quantity: z.number().positive().optional(),
    counted_quantity: z.number().min(0).optional(),
    transaction_date: z.string().min(1, "Date is required"),
    reason: z.string().min(1, "Reason is required").max(500),
    reference: z.string().max(255).nullable().optional(),
    lot_number: z.string().max(80).nullable().optional(),
    unit_cost: z.number().min(0).nullable().optional(),
    supplier: z.string().max(150).nullable().optional(),
    expiry_date: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "physical_count") {
      if (data.counted_quantity == null) {
        ctx.addIssue({
          code: "custom",
          message: "Counted quantity is required for physical count.",
          path: ["counted_quantity"],
        });
      }
      return;
    }
    if (data.action === "adjustment" && !data.direction) {
      ctx.addIssue({
        code: "custom",
        message: "Direction is required for adjustments.",
        path: ["direction"],
      });
    }
    if (data.action !== "physical_count" && data.quantity == null) {
      ctx.addIssue({
        code: "custom",
        message: "Quantity is required.",
        path: ["quantity"],
      });
    }
  });

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  item_id: z.coerce.number().int().positive().optional(),
  category: z.string().optional(),
  transaction_type: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const inventoryIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type InventoryQueryParams = z.infer<typeof inventoryQuerySchema>;
export type StockMovementInput = z.infer<typeof stockMovementSchema>;
export type StockInInput = z.infer<typeof stockInSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type TransactionQueryParams = z.infer<typeof transactionQuerySchema>;
