/**
 * Plain response shapes for endpoints that don't get wrapped in a structure
 * class (no caching/mutation methods needed) — as opposed to Guild/Channel/
 * Message/etc., which are full classes. Shared across Guild.ts and Channel.ts.
 */

/** A member entry as returned by {@link Guild.searchMembers}. */
export interface MemberSearchResultDTO {
    publicId: string;
    name: string;
    tag: string;
    image: string | null;
    isBot: boolean;
    isOwner: boolean;
    roles: Array<{ publicId: string; name: string; color: string | null; hoist: boolean; position: number }>;
}

/** A banned user entry as returned by {@link Guild.fetchBans}. */
export interface BanDTO {
    publicId: string;
    reason: string | null;
    createdAt: string;
    user: { publicId: string; name: string; tag: string; image: string | null };
}

/** An invite as returned by {@link Guild.fetchInvites} / {@link Guild.createInvite} / {@link Channel.createInvite}. */
export interface GuildInviteDTO {
    code: string;
    expiresAt: string | null;
    maxUses?: number | null;
    uses?: number;
    inviter?: { publicId: string; name: string; image: string | null; tag: string };
    channel?: { publicId: string; name: string };
}

/** An audit log entry as returned by {@link Guild.fetchAuditLogs}. */
export interface AuditLogEntryDTO {
    publicId: string;
    actionType: string;
    targetType: string;
    targetId: string;
    details: unknown;
    executor: { publicId: string; name: string; tag: string; image: string | null } | null;
    createdAt: string;
}

/** A permission override entry as returned by {@link Channel.fetchPermissionOverrides} / {@link Category.fetchPermissionOverrides}. */
export interface PermissionOverrideDTO {
    id: string;
    type: "ROLE" | "MEMBER";
    targetId: string;
    targetName: string;
    allow: string;
    deny: string;
}

/** A role reference as attached to a {@link Member}'s `.roles` — the API embeds full role data here. */
export interface MemberRoleRef {
    id?: string;
    publicId?: string;
    permissions?: string | number | bigint;
}

/** A server entry as returned by {@link User.fetchMutualServers}. */
export interface MutualServerDTO {
    publicId: string;
    name: string;
    imageUrl: string | null;
}

/** A single reactor as returned by {@link Message.fetchReactions}. */
export interface ReactionUserDTO {
    userPublicId: string;
    userName: string;
    userImage: string | null;
}

/** The payload delivered on the `messageReactionAdd` event / resolved by {@link Message.awaitReactions}. */
export interface MessageReactionEventData {
    messagePublicId: string;
    emoji: string;
    userPublicId?: string;
}
