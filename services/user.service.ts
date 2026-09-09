import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { ASSIGNABLE_ROLES, normalizeRole } from "@/lib/rbac/permissions";
import type { Role } from "@/types";

export type UserListItem = {
  user_id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: Date | null;
};

function assertAssignableRole(role: string): Role {
  const normalized = normalizeRole(role);
  if (!ASSIGNABLE_ROLES.includes(normalized)) {
    throw new ValidationError("Invalid role.");
  }
  return normalized;
}

export async function listUsers(search?: string): Promise<UserListItem[]> {
  const rows = await prisma.users.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ is_active: "desc" }, { name: "asc" }],
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
      is_active: true,
      created_at: true,
    },
  });

  return rows.map((row) => ({
    ...row,
    role: normalizeRole(row.role) as Role,
  }));
}

export async function createUser(
  actorId: number,
  data: {
    name: string;
    email: string;
    password: string;
    role: string;
    is_active?: boolean;
  },
) {
  const role = assertAssignableRole(data.role);
  const existing = await prisma.users.findUnique({ where: { email: data.email } });
  if (existing) throw new ConflictError("A user with this email already exists.");

  const password_hash = await bcrypt.hash(data.password, 10);
  return prisma.users.create({
    data: {
      name: data.name,
      email: data.email,
      password_hash,
      role,
      is_active: data.is_active ?? true,
    },
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
      is_active: true,
      created_at: true,
    },
  });
}

export async function updateUser(
  actorId: number,
  userId: number,
  data: {
    name?: string;
    email?: string;
    role?: string;
    is_active?: boolean;
  },
) {
  const existing = await prisma.users.findUnique({ where: { user_id: userId } });
  if (!existing) throw new NotFoundError("User");

  if (data.email && data.email !== existing.email) {
    const emailTaken = await prisma.users.findUnique({ where: { email: data.email } });
    if (emailTaken) throw new ConflictError("A user with this email already exists.");
  }

  const nextRole = data.role ? assertAssignableRole(data.role) : normalizeRole(existing.role);

  if (existing.role === "ADMIN" && nextRole !== "ADMIN") {
    const adminCount = await prisma.users.count({
      where: { role: "ADMIN", is_active: true, user_id: { not: userId } },
    });
    if (adminCount === 0) {
      throw new ForbiddenError("Cannot remove the last active administrator.");
    }
  }

  if (userId === actorId && data.is_active === false) {
    throw new ForbiddenError("You cannot deactivate your own account.");
  }

  return prisma.users.update({
    where: { user_id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.role !== undefined ? { role: nextRole } : {}),
      ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      updated_at: new Date(),
    },
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
      is_active: true,
      created_at: true,
    },
  });
}

export async function resetUserPassword(userId: number, newPassword: string) {
  const existing = await prisma.users.findUnique({ where: { user_id: userId } });
  if (!existing) throw new NotFoundError("User");
  const password_hash = await bcrypt.hash(newPassword, 10);
  await prisma.users.update({
    where: { user_id: userId },
    data: { password_hash, updated_at: new Date() },
  });
}

export async function deleteUser(actorId: number, userId: number) {
  if (actorId === userId) {
    throw new ForbiddenError("You cannot delete your own account.");
  }

  const existing = await prisma.users.findUnique({ where: { user_id: userId } });
  if (!existing) throw new NotFoundError("User");

  if (existing.role === "ADMIN") {
    const adminCount = await prisma.users.count({
      where: { role: "ADMIN", is_active: true, user_id: { not: userId } },
    });
    if (adminCount === 0) {
      throw new ForbiddenError("Cannot delete the last active administrator.");
    }
  }

  await prisma.users.delete({ where: { user_id: userId } });
}
