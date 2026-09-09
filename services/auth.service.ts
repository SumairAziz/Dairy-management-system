import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import type { AuthUser, Role } from "@/types";

export async function register(data: {
  name: string;
  email: string;
  password: string;
  role: string;
}): Promise<AuthUser> {
  const existing = await prisma.users.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new Error("Email already registered");
  }
  const password_hash = await bcrypt.hash(data.password, 10);
  const user = await prisma.users.create({
    data: {
      name: data.name,
      email: data.email,
      password_hash,
      role: data.role as Role,
    },
  });
  return { id: user.user_id, email: user.email, name: user.name, role: user.role };
}

export async function findByEmail(email: string) {
  return prisma.users.findUnique({ where: { email } });
}

export async function findById(id: number): Promise<AuthUser | null> {
  const user = await prisma.users.findUnique({
    where: { user_id: id },
    select: { user_id: true, email: true, name: true, role: true },
  });
  if (!user) return null;
  return { id: user.user_id, email: user.email, name: user.name, role: user.role as Role };
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.users.findUnique({ where: { user_id: userId } });
  if (!user?.password_hash) {
    throw new Error("INVALID_CURRENT_PASSWORD");
  }

  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    throw new Error("INVALID_CURRENT_PASSWORD");
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  await prisma.users.update({
    where: { user_id: userId },
    data: { password_hash },
  });
}
