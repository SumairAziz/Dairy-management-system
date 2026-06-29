import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma and serialize BEFORE importing service — factory must be self-contained
vi.mock("@/lib/db", () => ({
  prisma: {
    audit_logs: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/serialize", () => ({
  serialize: (v: unknown) => v,
}));

import * as auditService from "@/services/audit.service";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

describe("audit.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("log", () => {
    it("should call prisma.audit_logs.create with correct data", async () => {
      vi.mocked(prisma.audit_logs.create).mockResolvedValue({ id: 1 } as any);
      await auditService.log(1, "animals", 42, "CREATE", undefined, { tag_number: "T-001" });

      expect(prisma.audit_logs.create).toHaveBeenCalledOnce();
      expect(prisma.audit_logs.create).toHaveBeenCalledWith({
        data: {
          user_id: 1,
          entity: "animals",
          entity_id: 42,
          action: "CREATE",
          old_values: null,
          new_values: { tag_number: "T-001" },
        },
      });
    });

    it("should pass old_values and null new_values when only oldValues provided", async () => {
      vi.mocked(prisma.audit_logs.create).mockResolvedValue({ id: 2 } as any);
      await auditService.log(5, "farms", 10, "DELETE", { farm_name: "Old" });

      const call = (prisma.audit_logs.create as any).mock.calls[0][0];
      expect(call.data.old_values).toEqual({ farm_name: "Old" });
      expect(call.data.new_values).toBe(null);
    });

    it("should pass null for both when neither provided", async () => {
      vi.mocked(prisma.audit_logs.create).mockResolvedValue({ id: 3 } as any);
      await auditService.log(5, "farms", 10, "DELETE");

      const call = (prisma.audit_logs.create as any).mock.calls[0][0];
      expect(call.data.old_values).toBe(null);
      expect(call.data.new_values).toBe(null);
    });
  });

  describe("findAll", () => {
    it("should apply default pagination", async () => {
      vi.mocked(prisma.audit_logs.findMany).mockResolvedValue([]);
      vi.mocked(prisma.audit_logs.count).mockResolvedValue(0);

      const result = await auditService.findAll();
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);

      const findManyCall = (prisma.audit_logs.findMany as any).mock.calls[0][0];
      expect(findManyCall.skip).toBe(0);
      expect(findManyCall.take).toBe(20);
    });

    it("should apply custom pagination", async () => {
      vi.mocked(prisma.audit_logs.findMany).mockResolvedValue([]);
      vi.mocked(prisma.audit_logs.count).mockResolvedValue(0);

      const result = await auditService.findAll({ page: 3, pageSize: 10 });
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);

      const findManyCall = (prisma.audit_logs.findMany as any).mock.calls[0][0];
      expect(findManyCall.skip).toBe(20);
      expect(findManyCall.take).toBe(10);
    });

    it("should clamp pageSize to 100 max", async () => {
      vi.mocked(prisma.audit_logs.findMany).mockResolvedValue([]);
      vi.mocked(prisma.audit_logs.count).mockResolvedValue(0);

      const result = await auditService.findAll({ pageSize: 200 });
      expect(result.pageSize).toBe(100);
    });

    it("should clamp pageSize to 1 min", async () => {
      vi.mocked(prisma.audit_logs.findMany).mockResolvedValue([]);
      vi.mocked(prisma.audit_logs.count).mockResolvedValue(0);

      const result = await auditService.findAll({ pageSize: 0 });
      expect(result.pageSize).toBe(1);
    });

    it("should filter by entity", async () => {
      vi.mocked(prisma.audit_logs.findMany).mockResolvedValue([]);
      vi.mocked(prisma.audit_logs.count).mockResolvedValue(0);

      await auditService.findAll({ entity: "animals" });

      const findManyCall = (prisma.audit_logs.findMany as any).mock.calls[0][0];
      expect(findManyCall.where.entity).toBe("animals");

      const countCall = (prisma.audit_logs.count as any).mock.calls[0][0];
      expect(countCall.where.entity).toBe("animals");
    });

    it("should filter by user_id", async () => {
      vi.mocked(prisma.audit_logs.findMany).mockResolvedValue([]);
      vi.mocked(prisma.audit_logs.count).mockResolvedValue(0);

      await auditService.findAll({ user_id: 5 });

      const findManyCall = (prisma.audit_logs.findMany as any).mock.calls[0][0];
      expect(findManyCall.where.user_id).toBe(5);
    });

    it("should filter by action", async () => {
      vi.mocked(prisma.audit_logs.findMany).mockResolvedValue([]);
      vi.mocked(prisma.audit_logs.count).mockResolvedValue(0);

      await auditService.findAll({ action: "DELETE" });

      const findManyCall = (prisma.audit_logs.findMany as any).mock.calls[0][0];
      expect(findManyCall.where.action).toBe("DELETE");
    });

    it("should order by created_at desc and include user relation", async () => {
      vi.mocked(prisma.audit_logs.findMany).mockResolvedValue([]);
      vi.mocked(prisma.audit_logs.count).mockResolvedValue(0);

      await auditService.findAll();

      const findManyCall = (prisma.audit_logs.findMany as any).mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ created_at: "desc" });
      expect(findManyCall.include).toEqual({
        users: { select: { user_id: true, name: true, email: true, role: true } },
      });
    });

    it("should return data and total from parallel queries", async () => {
      const mockData = [{ id: 1, entity: "animals" }, { id: 2, entity: "farms" }];
      vi.mocked(prisma.audit_logs.findMany).mockResolvedValue(mockData);
      vi.mocked(prisma.audit_logs.count).mockResolvedValue(42);

      const result = await auditService.findAll({ page: 1, pageSize: 10 });
      expect(result.data).toEqual(mockData);
      expect(result.total).toBe(42);
    });
  });

  describe("findById", () => {
    it("should throw AppError(404) when record does not exist", async () => {
      vi.mocked(prisma.audit_logs.findUnique).mockResolvedValue(null);
      // audit.service uses dynamic import() for NotFoundError, so instanceof won't match
      // our static import. Check the error properties instead.
      await expect(auditService.findById(999)).rejects.toMatchObject({
        statusCode: 404,
        code: "NOT_FOUND",
      });
    });

    it("should return the record when found", async () => {
      const mockRecord = { id: 1, entity: "animals", user_id: 5, users: { name: "Test" } };
      vi.mocked(prisma.audit_logs.findUnique).mockResolvedValue(mockRecord as any);
      const result = await auditService.findById(1);
      expect(result).toEqual(mockRecord);
    });

    it("should include user relation", async () => {
      vi.mocked(prisma.audit_logs.findUnique).mockResolvedValue({ id: 1 } as any);
      await auditService.findById(1);

      const call = (prisma.audit_logs.findUnique as any).mock.calls[0][0];
      expect(call.include).toEqual({
        users: { select: { user_id: true, name: true, email: true, role: true } },
      });
    });
  });
});