"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Notification } from "@/types";

export function useNotifications(options?: { onlyUnread?: boolean }) {
  const query = options?.onlyUnread ? "?unread=true" : "";
  return useQuery({
    queryKey: ["notifications", options?.onlyUnread],
    queryFn: () => api.get<Notification[]>(`/notifications${query}`),
    refetchInterval: 30_000, // auto-refresh every 30s
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notification-unread-count"],
    queryFn: () => api.get<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 15_000, // poll every 15s for badge updates
    select: (data) => data.count,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch<Notification>(`/notifications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-unread-count"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch<{ marked: number }>("/notifications", { action: "mark_all_read" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-unread-count"] });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/notifications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-unread-count"] });
    },
  });
}