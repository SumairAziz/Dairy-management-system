import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { publishToUsers } from "@/lib/chat/event-bus";
import { normalizeRole } from "@/lib/rbac/permissions";
import type { Role } from "@/types";

export const ONLINE_THRESHOLD_MS = 60_000;
export const INITIAL_MESSAGE_BATCH = 10;
export const OLDER_MESSAGE_BATCH = 20;

export type ChatUser = {
  user_id: number;
  name: string;
  email: string;
  role: Role;
  is_online: boolean;
  last_seen_at: string | null;
};

export type ChatAttachmentDto = {
  attachment_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  original_file_size: number | null;
  url: string;
  thumbnail_url: string | null;
  download_url: string;
  media_type: "image" | "video" | "file";
  is_image: boolean;
  is_video: boolean;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
};

export type ChatMessageDto = {
  message_id: number;
  conversation_id: number;
  sender_id: number;
  sender_name: string;
  body: string | null;
  message_type: string;
  created_at: string;
  attachments: ChatAttachmentDto[];
  read_by_other: boolean;
  is_mine: boolean;
};

export type ConversationListItem = {
  conversation_id: number;
  other_user: ChatUser;
  last_message: {
    message_id: number;
    body: string | null;
    message_type: string;
    sender_id: number;
    created_at: string;
    attachment_preview?: { file_name: string; media_type: string } | null;
  } | null;
  unread_count: number;
  updated_at: string | null;
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function serializePresence(lastSeen: Date | null | undefined) {
  if (!lastSeen) return { is_online: false, last_seen_at: null as string | null };
  const lastSeenMs = lastSeen.getTime();
  const is_online = Date.now() - lastSeenMs <= ONLINE_THRESHOLD_MS;
  return { is_online, last_seen_at: lastSeen.toISOString() };
}

async function getPresenceMap(userIds: number[]) {
  if (userIds.length === 0) return new Map<number, { is_online: boolean; last_seen_at: string | null }>();
  const rows = await prisma.user_presence.findMany({
    where: { user_id: { in: userIds } },
  });
  const map = new Map<number, { is_online: boolean; last_seen_at: string | null }>();
  for (const row of rows) {
    map.set(row.user_id, serializePresence(row.last_seen_at));
  }
  for (const id of userIds) {
    if (!map.has(id)) map.set(id, { is_online: false, last_seen_at: null });
  }
  return map;
}

export async function touchPresence(userId: number) {
  const now = new Date();
  await prisma.user_presence.upsert({
    where: { user_id: userId },
    update: { last_seen_at: now, updated_at: now },
    create: { user_id: userId, last_seen_at: now, updated_at: now },
  });

  const participantRows = await prisma.chat_conversation_participants.findMany({
    where: { user_id: { not: userId } },
    select: { user_id: true },
    distinct: ["user_id"],
  });
  const notifyIds = [...new Set(participantRows.map((row) => row.user_id))];
  publishToUsers(notifyIds, {
    type: "presence",
    payload: { user_id: userId, is_online: true, last_seen_at: now.toISOString() },
  });
}

export async function markOffline(userId: number) {
  const now = new Date();
  await prisma.user_presence.upsert({
    where: { user_id: userId },
    update: { last_seen_at: now, updated_at: now },
    create: { user_id: userId, last_seen_at: now, updated_at: now },
  });

  const participantRows = await prisma.chat_conversation_participants.findMany({
    where: { user_id: { not: userId } },
    select: { user_id: true },
    distinct: ["user_id"],
  });
  publishToUsers(
    [...new Set(participantRows.map((row) => row.user_id))],
    {
      type: "presence",
      payload: { user_id: userId, is_online: false, last_seen_at: now.toISOString() },
    },
  );
}

export async function listChatUsers(currentUserId: number, search?: string) {
  const rows = await prisma.users.findMany({
    where: {
      is_active: true,
      user_id: { not: currentUserId },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: { user_id: true, name: true, email: true, role: true },
  });

  const presence = await getPresenceMap(rows.map((row) => row.user_id));
  return rows.map((row) => {
    const p = presence.get(row.user_id)!;
    return {
      user_id: row.user_id,
      name: row.name,
      email: row.email,
      role: normalizeRole(row.role) as Role,
      is_online: p.is_online,
      last_seen_at: p.last_seen_at,
    } satisfies ChatUser;
  });
}

export async function assertParticipant(conversationId: number, userId: number) {
  const participant = await prisma.chat_conversation_participants.findUnique({
    where: {
      conversation_id_user_id: { conversation_id: conversationId, user_id: userId },
    },
  });
  if (!participant) throw new ForbiddenError("You do not have access to this conversation.");
  return participant;
}

async function getOtherParticipantId(conversationId: number, userId: number) {
  const others = await prisma.chat_conversation_participants.findMany({
    where: { conversation_id: conversationId, user_id: { not: userId } },
    select: { user_id: true },
  });
  return others[0]?.user_id ?? null;
}

export async function getOrCreateDirectConversation(currentUserId: number, otherUserId: number) {
  if (currentUserId === otherUserId) {
    throw new ValidationError("Cannot start a conversation with yourself.");
  }

  const other = await prisma.users.findFirst({
    where: { user_id: otherUserId, is_active: true },
    select: { user_id: true },
  });
  if (!other) throw new NotFoundError("User");

  const candidates = await prisma.chat_conversations.findMany({
    where: {
      type: "direct",
      AND: [
        { participants: { some: { user_id: currentUserId } } },
        { participants: { some: { user_id: otherUserId } } },
      ],
    },
    include: {
      participants: {
        include: {
          users: { select: { user_id: true, name: true, email: true, role: true } },
        },
      },
    },
  });

  const existing = candidates.find((conversation) => conversation.participants.length === 2);
  if (existing) return existing;

  return prisma.chat_conversations.create({
    data: {
      type: "direct",
      participants: {
        create: [{ user_id: currentUserId }, { user_id: otherUserId }],
      },
    },
    include: {
      participants: {
        include: {
          users: { select: { user_id: true, name: true, email: true, role: true } },
        },
      },
    },
  });
}

export function mapAttachmentDto(attachment: {
  attachment_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  original_file_size: number | null;
  media_type: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  thumbnail_storage_key: string | null;
}): ChatAttachmentDto {
  const mediaType =
    attachment.media_type === "image" || attachment.media_type === "video"
      ? attachment.media_type
      : attachment.file_type.startsWith("image/")
        ? "image"
        : attachment.file_type.startsWith("video/")
          ? "video"
          : "file";
  const baseUrl = `/api/chat/attachments/${attachment.attachment_id}`;
  return {
    attachment_id: attachment.attachment_id,
    file_name: attachment.file_name,
    file_type: attachment.file_type,
    file_size: attachment.file_size,
    original_file_size: attachment.original_file_size,
    url: baseUrl,
    thumbnail_url: attachment.thumbnail_storage_key ? `${baseUrl}?variant=thumbnail` : null,
    download_url: `${baseUrl}?download=1`,
    media_type: mediaType,
    is_image: mediaType === "image",
    is_video: mediaType === "video",
    width: attachment.width,
    height: attachment.height,
    duration_seconds: attachment.duration_seconds,
  };
}

async function mapMessages(
  conversationId: number,
  currentUserId: number,
  rows: Array<{
    message_id: number;
    conversation_id: number;
    sender_id: number;
    body: string | null;
    message_type: string;
    created_at: Date | null;
    sender: { name: string };
    attachments: Array<{
      attachment_id: number;
      file_name: string;
      file_type: string;
      file_size: number;
      original_file_size: number | null;
      media_type: string;
      width: number | null;
      height: number | null;
      duration_seconds: number | null;
      thumbnail_storage_key: string | null;
    }>;
    reads: Array<{ user_id: number }>;
  }>,
): Promise<ChatMessageDto[]> {
  const otherUserId = await getOtherParticipantId(conversationId, currentUserId);
  return rows.map((row) => ({
    message_id: row.message_id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    sender_name: row.sender.name,
    body: row.body,
    message_type: row.message_type,
    created_at: row.created_at?.toISOString() ?? new Date().toISOString(),
    attachments: row.attachments.map((attachment) => mapAttachmentDto(attachment)),
    read_by_other:
      row.sender_id === currentUserId
        ? otherUserId
          ? row.reads.some((read) => read.user_id === otherUserId)
          : false
        : false,
    is_mine: row.sender_id === currentUserId,
  }));
}

const messageInclude = {
  sender: { select: { name: true } },
  attachments: {
    select: {
      attachment_id: true,
      file_name: true,
      file_type: true,
      file_size: true,
      original_file_size: true,
      media_type: true,
      width: true,
      height: true,
      duration_seconds: true,
      thumbnail_storage_key: true,
    },
  },
  reads: { select: { user_id: true } },
} as const;

export async function listConversations(userId: number): Promise<ConversationListItem[]> {
  const participations = await prisma.chat_conversation_participants.findMany({
    where: { user_id: userId },
    include: {
      chat_conversations: {
        include: {
          messages: {
            orderBy: { message_id: "desc" },
            take: 1,
            select: {
              message_id: true,
              body: true,
              message_type: true,
              sender_id: true,
              created_at: true,
              attachments: {
                take: 1,
                orderBy: { attachment_id: "asc" },
                select: { file_name: true, media_type: true },
              },
            },
          },
          participants: {
            where: { user_id: { not: userId } },
            include: {
              users: { select: { user_id: true, name: true, email: true, role: true } },
            },
          },
        },
      },
    },
    orderBy: { participant_id: "desc" },
  });

  participations.sort((a, b) => {
    const aTime = a.chat_conversations.last_message_at?.getTime() ?? 0;
    const bTime = b.chat_conversations.last_message_at?.getTime() ?? 0;
    return bTime - aTime;
  });

  const otherUserIds = participations
    .map((p) => p.chat_conversations.participants[0]?.users.user_id)
    .filter((id): id is number => Boolean(id));
  const presence = await getPresenceMap(otherUserIds);

  const items: ConversationListItem[] = [];
  for (const participation of participations) {
    const conversation = participation.chat_conversations;
    const other = conversation.participants[0]?.users;
    if (!other) continue;

    const unread_count = await prisma.chat_messages.count({
      where: {
        conversation_id: conversation.conversation_id,
        sender_id: { not: userId },
        ...(participation.last_read_message_id
          ? { message_id: { gt: participation.last_read_message_id } }
          : {}),
      },
    });

    const last = conversation.messages[0];
    const p = presence.get(other.user_id)!;
    items.push({
      conversation_id: conversation.conversation_id,
      other_user: {
        user_id: other.user_id,
        name: other.name,
        email: other.email,
        role: normalizeRole(other.role) as Role,
        is_online: p.is_online,
        last_seen_at: p.last_seen_at,
      },
      last_message: last
        ? {
            message_id: last.message_id,
            body: last.body,
            message_type: last.message_type,
            sender_id: last.sender_id,
            created_at: last.created_at?.toISOString() ?? new Date().toISOString(),
            attachment_preview: last.attachments[0]
              ? {
                  file_name: last.attachments[0].file_name,
                  media_type: last.attachments[0].media_type,
                }
              : null,
          }
        : null,
      unread_count,
      updated_at: conversation.last_message_at?.toISOString() ?? conversation.updated_at?.toISOString() ?? null,
    });
  }

  return items;
}

export async function getInitialMessages(conversationId: number, userId: number) {
  await assertParticipant(conversationId, userId);
  const today = startOfToday();

  const latestBatch = await prisma.chat_messages.findMany({
    where: { conversation_id: conversationId },
    orderBy: { message_id: "desc" },
    take: INITIAL_MESSAGE_BATCH,
    select: { message_id: true },
  });

  const todayRows = await prisma.chat_messages.findMany({
    where: { conversation_id: conversationId, created_at: { gte: today } },
    select: { message_id: true },
  });

  const idSet = new Set<number>([
    ...latestBatch.map((row) => row.message_id),
    ...todayRows.map((row) => row.message_id),
  ]);

  if (idSet.size === 0) {
    return { messages: [] as ChatMessageDto[], has_more: false, oldest_message_id: null as number | null };
  }

  const rows = await prisma.chat_messages.findMany({
    where: { message_id: { in: [...idSet] } },
    orderBy: { message_id: "asc" },
    include: messageInclude,
  });

  const oldest = rows[0]?.message_id ?? null;
  const totalOlder = oldest
    ? await prisma.chat_messages.count({
        where: { conversation_id: conversationId, message_id: { lt: oldest } },
      })
    : 0;

  return {
    messages: await mapMessages(conversationId, userId, rows),
    has_more: totalOlder > 0,
    oldest_message_id: oldest,
  };
}

export async function getOlderMessages(
  conversationId: number,
  userId: number,
  beforeMessageId: number,
  limit = OLDER_MESSAGE_BATCH,
) {
  await assertParticipant(conversationId, userId);

  const rows = await prisma.chat_messages.findMany({
    where: { conversation_id: conversationId, message_id: { lt: beforeMessageId } },
    orderBy: { message_id: "desc" },
    take: limit,
    include: messageInclude,
  });

  const ordered = rows.reverse();
  const oldest = ordered[0]?.message_id ?? null;
  const has_more = oldest
    ? (await prisma.chat_messages.count({
        where: { conversation_id: conversationId, message_id: { lt: oldest } },
      })) > 0
    : false;

  return {
    messages: await mapMessages(conversationId, userId, ordered),
    has_more,
    oldest_message_id: oldest,
  };
}

export async function sendMessage(
  conversationId: number,
  senderId: number,
  input: { body?: string; message_type?: string; attachment_ids?: number[] },
) {
  await assertParticipant(conversationId, senderId);

  const body = input.body?.trim() ?? null;
  let messageType = input.message_type ?? "text";
  if (!body && (!input.attachment_ids || input.attachment_ids.length === 0)) {
    throw new ValidationError("Message cannot be empty.");
  }

  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    if (input.attachment_ids?.length) {
      const pending = await tx.chat_message_attachments.findMany({
        where: {
          attachment_id: { in: input.attachment_ids },
          message_id: null,
          storage_key: { startsWith: `${conversationId}/` },
        },
        select: { media_type: true },
      });
      if (pending.length !== input.attachment_ids.length) {
        throw new ValidationError("One or more attachments are invalid or already sent.");
      }
      if (pending.some((item) => item.media_type === "video")) {
        messageType = "video";
      } else if (pending.some((item) => item.media_type === "image")) {
        messageType = "image";
      } else {
        messageType = "file";
      }
    }

    const created = await tx.chat_messages.create({
      data: {
        conversation_id: conversationId,
        sender_id: senderId,
        body,
        message_type: messageType,
        created_at: now,
      },
    });

    if (input.attachment_ids?.length) {
      await tx.chat_message_attachments.updateMany({
        where: {
          attachment_id: { in: input.attachment_ids },
          message_id: null,
          storage_key: { startsWith: `${conversationId}/` },
        },
        data: { message_id: created.message_id },
      });
    }

    await tx.chat_conversations.update({
      where: { conversation_id: conversationId },
      data: { last_message_at: now, updated_at: now },
    });

    return created;
  });

  const full = await prisma.chat_messages.findUnique({
    where: { message_id: message.message_id },
    include: messageInclude,
  });
  if (!full) throw new NotFoundError("Message");

  const dto = (await mapMessages(conversationId, senderId, [full]))[0];
  const participantIds = await prisma.chat_conversation_participants.findMany({
    where: { conversation_id: conversationId },
    select: { user_id: true },
  });

  publishToUsers(
    participantIds.map((row) => row.user_id),
    { type: "message", payload: { conversation_id: conversationId, message: dto } },
  );

  return dto;
}

export async function markConversationRead(conversationId: number, userId: number) {
  const participant = await assertParticipant(conversationId, userId);
  const latest = await prisma.chat_messages.findFirst({
    where: { conversation_id: conversationId },
    orderBy: { message_id: "desc" },
  });
  if (!latest) return { updated: 0 };

  const unread = await prisma.chat_messages.findMany({
    where: {
      conversation_id: conversationId,
      sender_id: { not: userId },
      message_id: {
        gt: participant.last_read_message_id ?? 0,
      },
    },
    select: { message_id: true, sender_id: true },
  });

  if (unread.length === 0 && participant.last_read_message_id === latest.message_id) {
    return { updated: 0 };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.chat_conversation_participants.update({
      where: { participant_id: participant.participant_id },
      data: {
        last_read_message_id: latest.message_id,
        last_read_at: now,
      },
    });

    for (const row of unread) {
      await tx.chat_message_reads.upsert({
        where: { message_id_user_id: { message_id: row.message_id, user_id: userId } },
        update: { read_at: now },
        create: { message_id: row.message_id, user_id: userId, read_at: now },
      });
    }
  });

  const otherUserId = await getOtherParticipantId(conversationId, userId);
  if (otherUserId) {
    publishToUsers([otherUserId], {
      type: "read",
      payload: {
        conversation_id: conversationId,
        reader_id: userId,
        last_read_message_id: latest.message_id,
      },
    });
  }

  return { updated: unread.length };
}

export async function createPendingAttachment(
  conversationId: number,
  userId: number,
  data: {
    storageKey: string;
    thumbnailStorageKey: string | null;
    fileName: string;
    fileType: string;
    fileSize: number;
    originalFileSize: number;
    mediaType: "image" | "video" | "file";
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
  },
) {
  await assertParticipant(conversationId, userId);
  return prisma.chat_message_attachments.create({
    data: {
      message_id: null,
      file_name: data.fileName,
      file_type: data.fileType,
      file_size: data.fileSize,
      original_file_size: data.originalFileSize,
      storage_key: data.storageKey,
      thumbnail_storage_key: data.thumbnailStorageKey,
      media_type: data.mediaType,
      width: data.width,
      height: data.height,
      duration_seconds: data.durationSeconds,
    },
  });
}

export async function getAttachmentForUser(attachmentId: number, userId: number) {
  const attachment = await prisma.chat_message_attachments.findUnique({
    where: { attachment_id: attachmentId },
  });

  if (!attachment) throw new NotFoundError("Attachment");

  if (attachment.message_id == null) {
    const pendingConversationId = Number(attachment.storage_key.split("/")[0]);
    await assertParticipant(pendingConversationId, userId);
    return attachment;
  }

  const message = await prisma.chat_messages.findUnique({
    where: { message_id: attachment.message_id },
    select: { conversation_id: true },
  });
  if (!message) throw new NotFoundError("Attachment");
  await assertParticipant(message.conversation_id, userId);
  return attachment;
}

export async function getConversationParticipantIds(conversationId: number) {
  const rows = await prisma.chat_conversation_participants.findMany({
    where: { conversation_id: conversationId },
    select: { user_id: true },
  });
  return rows.map((row) => row.user_id);
}
