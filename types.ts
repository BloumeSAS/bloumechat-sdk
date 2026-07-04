import type { Message } from "./structures/Message";
import type { Role } from "./structures/Role";

export interface ActivityData {
    type: "using" | "browsing" | "listening" | "playing";
    name: string;
    details?: string;
    startedAt?: number;
}

export interface PresenceData {
    status?: "online" | "idle" | "dnd" | "invisible";
    activity?: ActivityData | null;
}

export interface ActivityUpdateData {
    userPublicId: string;
    activity: (ActivityData & { startedAt: number }) | null;
}

export interface ProfileUpdateData {
    /** New username */
    name?: string;
    /** Short bio (null to clear) */
    bio?: string | null;
    /** Custom tag/discriminator (null to reset to default) */
    tag?: string | null;
    /** Avatar URL (null to reset to default) */
    image?: string | null;
    /** Banner image URL (null to clear) */
    banner?: string | null;
    /** Banner solid color in hex (null to clear) */
    bannerColor?: string | null;
}

/**
 * Every event the client can emit, keyed by name, with the exact argument
 * tuple each listener receives. Consumers get full autocomplete + type
 * checking on `client.on(...)` instead of `data: any` everywhere.
 */
export interface ClientEvents {
    ready: [];
    reconnect: [];
    disconnect: [reason: string];
    error: [error: Error];

    message: [message: Message];
    messageCreate: [message: Message];
    messageUpdate: [data: any];
    messageDelete: [data: any];
    messageReactionAdd: [data: any];
    messageReactionRemoveAll: [data: any];
    messagePin: [data: any];

    guildUpdate: [data: any];
    guildDelete: [data: any];
    guildMemberAdd: [data: any];
    guildMemberRemove: [data: any];
    /** Fired when a member's roles/nickname change (via `server:member_update`). */
    guildMemberUpdate: [data: any];
    /** Fired when a member is banned — derived from `server:member_removed` with `reason: "banned"`. */
    guildBanAdd: [data: any];
    /** Fired when a ban is lifted (via `server:ban_revoked`). */
    guildBanRemove: [data: any];
    guildChannelsUpdate: [data: any];
    guildCategoriesUpdate: [data: any];

    roleCreate: [role: Role];
    roleUpdate: [role: Role];
    roleDelete: [role: Role | string];
    roleOrderUpdate: [data: any];

    userUpdate: [data: any];
    typingStart: [data: any];
    typingStop: [data: any];
    presenceUpdate: [data: any];
    activityUpdate: [data: ActivityUpdateData];

    voiceStateUpdate: [data: any];

    dmNew: [data: any];
    notificationNew: [data: any];
}
