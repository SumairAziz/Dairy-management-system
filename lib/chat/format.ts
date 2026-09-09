export function formatRoleLabel(role: string) {
  return role.replace(/_/g, " ");
}

export function formatMessageTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatMessageDateDivider(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function messageDateKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatConversationTime(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return formatMessageTime(iso);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatLastSeen(iso: string | null, isOnline: boolean) {
  if (isOnline) return "Online";
  if (!iso) return "Offline";
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Last seen today at ${time}`;
  return `Last seen ${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${time}`;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function previewMessage(
  body: string | null,
  messageType: string,
  attachment?: { file_name: string; media_type: string } | null,
) {
  if (messageType === "image" || attachment?.media_type === "image") return "[Image] Photo";
  if (messageType === "video" || attachment?.media_type === "video") return "[Video] Video";
  if (messageType === "file" || attachment?.media_type === "file") {
    return `[File] ${attachment?.file_name ?? "File"}`;
  }
  return body?.trim() || "Message";
}

export function formatMediaDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null;
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
