import { z } from "zod";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { AiTool, ToolContext } from "../types";
import { objectSchema } from "./json-schema";
import { getDashboardData } from "@/services/dashboard.service";

const getDashboardSummary: AiTool<Record<string, never>> = {
  name: "getDashboardSummary",
  category: "Dashboard",
  description:
    "Get the same top-level farm-wide statistics shown on the main dashboard: total animals, farms, units, species/breeds, today's milk, pregnant count, milk trend, breeding/pregnancy/heat-cycle distributions, vaccination alerts, and farm capacity. Use this as a good default starting point for broad questions like 'give me an overview' or 'how's the farm doing'.",
  parameters: objectSchema({}),
  schema: z.object({}),
  async handler() {
    return await getDashboardData();
  },
};

const getNotificationsSummary: AiTool<Record<string, never>> = {
  name: "getNotificationsSummary",
  category: "Notifications",
  description: "Get the current user's unread notification count and the 10 most recent notifications (vaccination reminders, alerts, etc.).",
  parameters: objectSchema({}),
  schema: z.object({}),
  async handler(_args, ctx: ToolContext) {
    const [unreadCount, recent] = await Promise.all([
      prisma.notifications.count({ where: { user_id: ctx.userId, is_read: false } }),
      prisma.notifications.findMany({
        where: { user_id: ctx.userId },
        orderBy: { created_at: "desc" },
        take: 10,
      }),
    ]);
    return serialize({ unreadCount, recent });
  },
};

export const dashboardTools: AiTool<any, any>[] = [getDashboardSummary, getNotificationsSummary];
