import type { Message } from "./structures/Message";
import type { Role } from "./structures/Role";
import type { Guild } from "./structures/Guild";
import type { Member } from "./structures/Member";
import type {
    VoiceIncomingCallData,
    VoiceCallCancelledData,
    VoiceUser,
    VoiceUserJoinedData,
    VoiceUserStateData,
    VoiceUsersSnapshot,
} from "./voice/types";

export type {
    VoiceUser,
    VoiceStateUpdate,
    VoiceUserJoinedData,
    VoiceUserLeftData,
    VoiceUserStateData,
    VoiceUsersSnapshot,
    VoiceIncomingCallData,
    VoiceCallCancelledData,
    VoiceJoinOptions,
    PlayOptions,
    AudioResource,
    VoiceConnectionState,
} from "./voice/types";

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

    /** Fired when the bot is added to a new server (via `server:joined`) — the guild is already in `client.guilds.cache` by the time this fires. */
    guildCreate: [guild: Guild];
    guildUpdate: [data: any];
    guildDelete: [data: any];
    /** Fired when a member joins — `client.members.cache` is already updated by the time this fires. */
    guildMemberAdd: [member: Member];
    /** Fired when a member leaves, is kicked, or is banned — `client.members.cache` has already had the entry removed by the time this fires. */
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

    /** Bulk voice-room snapshot (fired on join and on `server:voice-states` replies). */
    voiceStateUpdate: [data: VoiceUsersSnapshot];
    /** Fired when any user (including the bot itself) joins a voice channel. */
    voiceUserJoined: [data: VoiceUserJoinedData];
    /** Fired when any user leaves a voice channel — also fired (as `voiceStateUpdate`-shaped data) for backwards compatibility. */
    voiceUserLeft: [data: { channelPublicId: string; userPublicId: string; users: VoiceUser[] }];
    /** Fired when a participant's mute/deafen/speaking/streaming state changes. */
    voiceUserState: [data: VoiceUserStateData];
    /** Fired when the bot receives an incoming DM/channel voice call. */
    voiceIncomingCall: [data: VoiceIncomingCallData];
    /** Fired when an incoming call is cancelled before being answered. */
    voiceCallCancelled: [data: VoiceCallCancelledData];

    dmNew: [data: any];
}
