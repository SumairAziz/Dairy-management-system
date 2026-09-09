import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    notifications: { count: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/lib/serialize", () => ({ serialize: (v: unknown) => v }));
vi.mock("@/services/dashboard.service", () => ({
  getDashboardData: vi.fn().mockResolvedValue({ totals: { animalCount: 42 } }),
}));

import { prisma } from "@/lib/db";
import { getDashboardData } from "@/services/dashboard.service";
import { dashboardTools } from "@/lib/ai/tools/dashboard.tools";

const getDashboardSummary = dashboardTools.find((t) => t.name === "getDashboardSummary")!;
const getNotificationsSummary = dashboardTools.find((t) => t.name === "getNotificationsSummary")!;

describe("ai tools: dashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getDashboardSummary delegates to the existing dashboard service (single source of truth)", async () => {
    const result = await getDashboardSummary.handler({}, { userId: 1, role: "ADMIN" });
    expect(getDashboardData).toHaveBeenCalledOnce();
    expect(result).toEqual({ totals: { animalCount: 42 } });
  });

  it("getNotificationsSummary scopes to the calling user", async () => {
    vi.mocked(prisma.notifications.count).mockResolvedValue(3);
    vi.mocked(prisma.notifications.findMany).mockResolvedValue([{ id: 1, title: "Vaccination due" }] as any);

    const result: any = await getNotificationsSummary.handler({}, { userId: 42, role: "VIEWER" });

    expect(vi.mocked(prisma.notifications.count).mock.calls[0][0]).toMatchObject({ where: { user_id: 42, is_read: false } });
    expect(result.unreadCount).toBe(3);
    expect(result.recent).toHaveLength(1);
  });
});
