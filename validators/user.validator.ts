import { z } from "zod";
import { ASSIGNABLE_ROLES } from "@/lib/rbac/permissions";

const roleSchema = z.enum(ASSIGNABLE_ROLES as [string, ...string[]]);

export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  role: roleSchema,
  is_active: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: roleSchema.optional(),
  is_active: z.boolean().optional(),
});

export const resetUserPasswordSchema = z.object({
  password: z.string().min(6),
});

export const userQuerySchema = z.object({
  search: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
