import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { NotFoundError } from "@/lib/errors";
import type { AuditLog } from "@/types";

export async function log(
  userId: number,
  entity: string,
  entityId: number,
  action: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
) {
  await prisma.audit_logs.create({
    data: {
      user_id: userId,
      entity,
      entity_id: entityId,
      action,
      old_values: oldValues ?? null,
      new_values: newValues ?? null,
    },
  });
}

export interface AuditLogQueryParams {
  page?: number;
  pageSize?: number;
  entity?: string;
  user_id?: number;
  action?: string;
}

export async function findAll(params: AuditLogQueryParams = {}) {
  const page = params.page ?? 1;
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const where: { entity?: string; user_id?: number; action?: string } = {};
  if (params.entity) where.entity = params.entity;
  if (params.user_id) where.user_id = params.user_id;
  if (params.action) where.action = params.action;

  const [data, total] = await Promise.all([
    prisma.audit_logs.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { created_at: "desc" },
      include: {
        users: { select: { user_id: true, name: true, email: true, role: true } },
      },
    }),
    prisma.audit_logs.count({ where }),
  ]);
  return {
    data: serialize(data) as AuditLog[],
    total,
    page,
    pageSize,
  };
}

export async function findById(id: number) {
  const record = await prisma.audit_logs.findUnique({
    where: { id },
    include: {
      users: { select: { user_id: true, name: true, email: true, role: true } },
    },
  });
  if (!record) throw new NotFoundError("Audit log");
  return serialize(record) as AuditLog;
}