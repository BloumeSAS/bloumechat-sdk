/**
 * Permission Flags (Bitmask)
 * We use BigInt because we might exceed 32 bits as the system grows.
 */
export const PermissionFlags = {
    // Server Permissions
    MANAGE_SERVER: 1n << 0n,
    MANAGE_ROLES: 1n << 1n,
    MANAGE_CHANNELS: 1n << 2n,
    VIEW_AUDIT_LOG: 1n << 3n, // Future-proofing
    MANAGE_INVITES: 1n << 4n,
    VIEW_MEMBERS: 1n << 5n,

    // Moderation Permissions
    KICK_MEMBERS: 1n << 6n,
    BAN_MEMBERS: 1n << 7n,
    MANAGE_MESSAGES: 1n << 8n, // Delete messages of others

    // Communication Permissions
    VIEW_CHANNELS: 1n << 9n,
    SEND_MESSAGES: 1n << 10n,
    UPLOAD_FILES: 1n << 11n,
    MENTION_EVERYONE: 1n << 12n,

    // Voice Permissions
    CONNECT: 1n << 13n,
    SPEAK: 1n << 14n,
    MUTE_MEMBERS: 1n << 15n,
    DEAFEN_MEMBERS: 1n << 16n,
    MOVE_MEMBERS: 1n << 17n,

    // Additional Chat Permissions
    PIN_MESSAGE: 1n << 18n,
    ADD_REACTION: 1n << 19n,

    // Administrator (Bypasses all checks)
    ADMINISTRATOR: 1n << 31n,

    // App Management
    MANAGE_APPLICATIONS: 1n << 20n,
} as const;

export type PermissionFlag = (typeof PermissionFlags)[keyof typeof PermissionFlags];

/**
 * Common permission sets
 */
export const DEFAULT_PERMISSIONS =
    PermissionFlags.VIEW_CHANNELS |
    PermissionFlags.SEND_MESSAGES |
    PermissionFlags.UPLOAD_FILES |
    PermissionFlags.ADD_REACTION |
    PermissionFlags.CONNECT |
    PermissionFlags.SPEAK;

export const ALL_PERMISSIONS = Object.values(PermissionFlags).reduce((acc, curr) => acc | curr, 0n);
