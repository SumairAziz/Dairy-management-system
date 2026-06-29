"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useAuth() {
  const { data: session, status } = useSession();
  return {
    user: session?.user ?? null,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
  };
}

export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signIn("credentials", { email, password, redirect: false }) as Promise<
        | { ok: true; url: string }
        | { ok: false; error: string | null; url: string | null }
      >,
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string; role: string }) =>
      api.post<{ id: number; email: string; name: string; role: string }>("/auth/register", data),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => signOut({ redirect: false }),
  });
}