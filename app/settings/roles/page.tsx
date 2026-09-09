"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Shield, X } from "lucide-react";
import { Navbar } from "@/app/components/navbar";
import { SettingsAdminNav } from "@/app/settings/components/SettingsAdminNav";
import { usePermissions } from "@/hooks/use-permissions";
import { useRolesMatrix, useUpdateRolePermissions } from "@/hooks/use-users";
import { ASSIGNABLE_ROLES, getRolePermissionMatrix } from "@/lib/rbac/permissions";
import { routes } from "@/lib/routes";
import type { Role } from "@/types";

type MatrixModule = {
  key: string;
  label: string;
  permissions: Array<{ key: string; allowed: boolean }>;
};

const EMPTY_MATRIX: MatrixModule[] = [];

function formatRole(role: Role) {
  return role.replace(/_/g, " ");
}

function permissionLabel(key: string) {
  const [, action] = key.split(".");
  return action?.replace(/_/g, " ") ?? key;
}

function matrixToDraft(matrix: MatrixModule[]) {
  const draft = new Set<string>();
  for (const module of matrix) {
    for (const permission of module.permissions) {
      if (permission.allowed) draft.add(permission.key);
    }
  }
  return draft;
}

export default function SettingsRolesPage() {
  const [selectedRole, setSelectedRole] = useState<Role>("ADMIN");
  const [isEditing, setIsEditing] = useState(false);
  const [draftPermissions, setDraftPermissions] = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { can } = usePermissions();
  const canEditRoles = can("roles.edit");
  const { data, isLoading, isError, error, refetch } = useRolesMatrix();
  const updateMutation = useUpdateRolePermissions();

  const fallbackRoles = useMemo(
    () =>
      ASSIGNABLE_ROLES.map((role) => ({
        role,
        editable: role !== "ADMIN",
        matrix: getRolePermissionMatrix(role),
      })),
    [],
  );

  const roles = data?.roles ?? (isError ? fallbackRoles : undefined);

  const roleEntry = useMemo(
    () => roles?.find((entry) => entry.role === selectedRole),
    [roles, selectedRole],
  );

  const matrix = roleEntry?.matrix ?? EMPTY_MATRIX;
  const roleEditable = roleEntry?.editable ?? selectedRole !== "ADMIN";

  const handleRoleSelect = (role: Role) => {
    if (isEditing) return;
    setSelectedRole(role);
    setDraftPermissions(new Set());
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const startEditing = () => {
    setDraftPermissions(matrixToDraft(matrix));
    setIsEditing(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const cancelEditing = () => {
    setDraftPermissions(new Set());
    setIsEditing(false);
    setErrorMessage(null);
  };

  const togglePermission = (key: string, enabled: boolean) => {
    setDraftPermissions((current) => {
      const next = new Set(current);
      if (enabled) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const toggleModulePermissions = (module: MatrixModule, enabled: boolean) => {
    setDraftPermissions((current) => {
      const next = new Set(current);
      for (const permission of module.permissions) {
        if (enabled) next.add(permission.key);
        else next.delete(permission.key);
      }
      return next;
    });
  };

  const saveChanges = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (draftPermissions.size === 0) {
      setErrorMessage("At least one permission must remain enabled.");
      return;
    }

    try {
      const result = await updateMutation.mutateAsync({
        role: selectedRole,
        permissions: Array.from(draftPermissions),
      });
      setDraftPermissions(new Set());
      setIsEditing(false);
      setSuccessMessage(result.message ?? "Role permissions updated successfully.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save permissions.");
    }
  };

  return (
    <>
      <Navbar title="Roles & Permissions" subtitle="Administration · RBAC matrix" />
      <div className="p-6 space-y-6 max-w-6xl">
        <Link
          href={routes.settings}
          className="inline-flex items-center gap-2 text-sm muted hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to Settings
        </Link>

        <SettingsAdminNav />

        <div className="surface border rounded-2xl p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-semibold flex items-center gap-2">
                <Shield size={16} /> Role Permissions
              </h1>
              <p className="text-sm muted mt-1">
                Permissions are managed centrally by role. Assign roles to users on the Users page.
              </p>
            </div>

            {canEditRoles && roleEditable && !isEditing && (
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-brand-600 text-white text-sm"
              >
                Edit Permissions
              </button>
            )}

            {canEditRoles && roleEditable && isEditing && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={updateMutation.isPending}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-60"
                >
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={updateMutation.isPending}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg border text-sm surface hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {selectedRole === "ADMIN" && (
            <p className="text-sm text-amber-400/90 border border-amber-400/20 rounded-lg px-3 py-2">
              ADMIN permissions are immutable to prevent accidental lockout.
            </p>
          )}

          {isError && (
            <div className="text-sm text-amber-400/90 border border-amber-400/20 rounded-lg px-3 py-2 space-y-2">
              <p>
                Could not load saved permissions from the server
                {error instanceof Error ? `: ${error.message}` : ""}. Showing default
                permissions until the API is available.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-brand-400 hover:underline"
              >
                Retry
              </button>
              <p className="text-xs muted">
                If this persists, run{" "}
                <code className="text-xs">npx prisma generate</code> and restart{" "}
                <code className="text-xs">npm run dev</code>.
              </p>
            </div>
          )}

          {successMessage && (
            <p className="text-sm text-emerald-400 border border-emerald-400/20 rounded-lg px-3 py-2">
              {successMessage}
            </p>
          )}

          {errorMessage && (
            <p className="text-sm text-red-400 border border-red-400/20 rounded-lg px-3 py-2">
              {errorMessage}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {ASSIGNABLE_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                disabled={isEditing}
                onClick={() => handleRoleSelect(role)}
                className={`px-3 py-2 rounded-lg border text-sm disabled:opacity-60 ${
                  selectedRole === role
                    ? "bg-brand-600 text-white border-brand-600"
                    : "surface hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                {formatRole(role)}
              </button>
            ))}
          </div>

          {isLoading && !roles ? (
            <p className="text-sm muted">Loading permission matrix…</p>
          ) : matrix.length === 0 ? (
            <p className="text-sm muted">No permissions found for this role.</p>
          ) : (
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-sm">
                <thead className="border-b bg-black/[0.02] dark:bg-white/[0.03]">
                  <tr>
                    <th className="text-left px-3 py-2">Module</th>
                    <th className="text-left px-3 py-2">Permission</th>
                    <th className="text-center px-3 py-2">Allowed</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.flatMap((module) =>
                    module.permissions.map((permission, index) => {
                      const allowed = isEditing
                        ? draftPermissions.has(permission.key)
                        : permission.allowed;
                      const allEnabled = module.permissions.every((entry) =>
                        draftPermissions.has(entry.key),
                      );

                      return (
                        <tr
                          key={permission.key}
                          className="border-t border-black/5 dark:border-white/10"
                        >
                          <td className="px-3 py-2 align-top">
                            {index === 0 ? (
                              <div className="space-y-2">
                                <div>{module.label}</div>
                                {isEditing && index === 0 && module.permissions.length > 1 && (
                                  <label className="inline-flex items-center gap-2 text-xs muted cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="rounded border"
                                      checked={allEnabled}
                                      onChange={(event) =>
                                        toggleModulePermissions(module, event.target.checked)
                                      }
                                    />
                                    All {module.label} permissions
                                  </label>
                                )}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 capitalize">{permissionLabel(permission.key)}</td>
                          <td className="px-3 py-2 text-center">
                            {isEditing ? (
                              <label className="inline-flex items-center justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="rounded border"
                                  checked={allowed}
                                  aria-label={`${module.label} ${permissionLabel(permission.key)}`}
                                  onChange={(event) =>
                                    togglePermission(permission.key, event.target.checked)
                                  }
                                />
                              </label>
                            ) : allowed ? (
                              <Check size={16} className="inline text-emerald-400" aria-label="Allowed" />
                            ) : (
                              <X size={16} className="inline text-red-400" aria-label="Not allowed" />
                            )}
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
