"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasPermissionKey, normalizeRole } from "@/lib/rbac/permissions";
import type { Role } from "@/types";

export function usePermissions() {
  const { user, isLoading, isAuthenticated } = useAuth();

  const role = useMemo(
    () => (user?.role ? normalizeRole(user.role) : null) as Role | null,
    [user?.role],
  );

  const permissionSet = useMemo(() => {
    if (user?.permissions?.length) {
      return new Set(user.permissions);
    }
    return null;
  }, [user?.permissions]);

  const can = useMemo(() => {
    return (permission: string) => {
      if (permissionSet) return permissionSet.has(permission);
      if (!role) return false;
      return hasPermissionKey(role, permission);
    };
  }, [permissionSet, role]);

  const isAdmin = role === "ADMIN";

  return {
    role,
    isLoading,
    isAuthenticated,
    can,
    isAdmin,
  };
}
