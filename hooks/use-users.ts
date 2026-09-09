"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Role } from "@/types";
import type { CreateUserInput, UpdateUserInput } from "@/validators/user.validator";

export type ManagedUser = {
  user_id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string | null;
};

export function useUsers(search = "") {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return useQuery({
    queryKey: ["users", search],
    queryFn: () => api.get<ManagedUser[]>(`/users${qs}`),
  });
}

export function useRolesMatrix() {
  return useQuery({
    queryKey: ["roles-matrix"],
    queryFn: () =>
      api.get<{
        roles: Array<{
          role: Role;
          editable: boolean;
          matrix: Array<{
            key: string;
            label: string;
            permissions: Array<{ key: string; allowed: boolean }>;
          }>;
        }>;
      }>("/roles"),
  });
}

export function useUpdateRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { role: Role; permissions: string[] }) =>
      api.put<{
        role: Role;
        permissions: string[];
        matrix: Array<{
          key: string;
          label: string;
          permissions: Array<{ key: string; allowed: boolean }>;
        }>;
        message: string;
      }>("/roles", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles-matrix"] }),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserInput) => api.post<ManagedUser>("/users", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserInput }) =>
      api.patch<ManagedUser>(`/users/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api.patch<{ success: boolean }>(`/users/${id}`, { password }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
