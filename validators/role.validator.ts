import { z } from "zod";
import { ALL_PERMISSIONS } from "@/lib/rbac/permissions";

const permissionKeySchema = z
  .string()
  .refine((value) => ALL_PERMISSIONS.includes(value), "Invalid permission key");

export const updateRolePermissionsSchema = z.object({
  role: z.string().min(1),
  permissions: z.array(permissionKeySchema).min(1),
});

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
