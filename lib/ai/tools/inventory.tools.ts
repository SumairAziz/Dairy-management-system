import { z } from "zod";
import type { AiTool } from "../types";
import { objectSchema, str, int } from "./json-schema";
import { limitSchema } from "./common";
import * as inventoryService from "@/services/inventory.service";

const getInventorySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  stock_status: z.enum(["in_stock", "low_stock", "out_of_stock"]).optional(),
  expiry_status: z.enum(["expired", "expiring", "expiring_soon", "ok", "none"]).optional(),
  limit: limitSchema,
});
type GetInventoryArgs = z.infer<typeof getInventorySchema>;

const getInventory: AiTool<GetInventoryArgs> = {
  name: "getInventory",
  category: "Inventory",
  description:
    "List medicine, feed, supplies, and other inventory items stored in TerraDairy. Use for questions like 'how much medicine do we have', 'what is in inventory', 'low stock items', 'expired vaccines', etc. Returns item names, quantities, units, stock status, expiry, and supplier. Read-only.",
  parameters: objectSchema({
    search: str("Free-text search on item name."),
    category: str("Filter by category, e.g. Medicine, Feed, Vaccine."),
    stock_status: str("in_stock, low_stock, or out_of_stock.", [
      "in_stock",
      "low_stock",
      "out_of_stock",
    ]),
    expiry_status: str("expired, expiring, expiring_soon, ok, or none.", [
      "expired",
      "expiring",
      "expiring_soon",
      "ok",
      "none",
    ]),
    limit: int("Max rows to return, default 50, max 200."),
  }),
  schema: getInventorySchema,
  async handler(args) {
    const pageSize = Math.min(args.limit ?? 50, 200);
    const result = await inventoryService.findAll({
      page: 1,
      pageSize,
      search: args.search,
      category: args.category,
      stock_status: args.stock_status,
      expiry_status: args.expiry_status,
      sort_by: "item_name",
      sort_order: "asc",
    });
    return result;
  },
};

export const inventoryTools: AiTool<any, any>[] = [getInventory];
