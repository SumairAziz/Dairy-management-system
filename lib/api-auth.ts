import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import type { Role } from "@/types";

type Ctx = { params: Promise<{ id: string }> };

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new UnauthorizedError("Authentication required");
  return session.user;
}

export async function requirePermission(module: string, action: string) {
  const user = await requireAuth();
  if (!hasPermission(user.role as Role, module, action)) {
    throw new ForbiddenError(`You don't have permission to ${action} ${module}`);
  }
  return user;
}

export async function resolveId(params: Ctx["params"], field = "id"): Promise<number> {
  const p = await params;
  const id = Number(p[field]);
  if (!id || !Number.isFinite(id)) throw new Error(`Invalid ${field}`);
  return id;
}