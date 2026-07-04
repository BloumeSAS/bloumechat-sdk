import { Base } from "./Base";
import { BloumeChat } from "../bloumechat";
import { RoleManager } from "../managers/RoleManager";
import { InviteManager } from "../managers/InviteManager";
import { EmojiManager } from "../managers/EmojiManager";
import { Role } from "./Role";
import { Category } from "./Category";
import { Channel } from "./Channel";
import { Emoji } from "./Emoji";
import { BloumeChatAuthError } from "../errors/BloumeChatAuthError";
import type { MemberSearchResultDTO, BanDTO, GuildInviteDTO, AuditLogEntryDTO } from "./dto";

export type { MemberSearchResultDTO, BanDTO, GuildInviteDTO, AuditLogEntryDTO } from "./dto";

export interface NotificationSettings {
    muted?: boolean;
    muteUntil?: string | null;
    mentionsOnly?: boolean;
}

/**
 * Represents a server (guild) on BloumeChat.
 */
export class Guild extends Base {
    /** Guild public ID (Snowflake) */
    public id: string;
    /** Server name */
    public name: string;
    /** Icon URL (null if none) */
    public icon: string | null;
    /** Public ID of the server owner */
    public ownerId: string;
    /** Approximate member count */
    public memberCount: number;
    /** Roles manager scoped to this server */
    public roles: RoleManager;
    /** Invites manager scoped to this server */
    public invites: InviteManager;
    /** Custom emojis manager scoped to this server */
    public emojis: EmojiManager;

    constructor(client: BloumeChat, data: any) {
        super(client);
        this.id = data.publicId;
        this.name = data.name;
        this.icon = data.imageUrl;
        // The /servers API doesn't expose a direct ownerId field — the owner is
        // marked via isOwner: true on the matching entry in data.members.
        this.ownerId = data.ownerId || (data.members || []).find((m: any) => m.isOwner === true)?.publicId;
        this.memberCount = typeof data.memberCount === "number" ? data.memberCount : 0;

        this.roles = new RoleManager(this);
        this.invites = new InviteManager(this);
        this.emojis = new EmojiManager(this);
    }

    /** Members manager scoped to this guild */
    get members() {
        return this.client.members;
    }
    /** Cached channels belonging to this guild */
    get channels() {
        return this.client.channels.cache.filter(c => c.serverId === this.id);
    }

    // ─── Server management ───────────────────────────────────────────────────

    /** Renames the server. */
    async setName(name: string): Promise<void> {
        await this.client.apiCall(`/servers/${this.id}`, {
            method: "PATCH",
            body: JSON.stringify({ name }),
        });
        this.name = name;
    }

    /** Edits the server (name and/or icon). */
    async edit(data: { name?: string; imageUrl?: string | null }): Promise<Guild> {
        await this.client.apiCall(`/servers/${this.id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        if (data.name !== undefined) this.name = data.name;
        if (data.imageUrl !== undefined) this.icon = data.imageUrl;
        return this;
    }

    /** Bot leaves the server. */
    async leave(): Promise<void> {
        await this.client.apiCall(`/servers/${this.id}/leave`, { method: "POST" });
    }

    /** Permanently deletes the server (bot must be owner). */
    async delete(): Promise<void> {
        await this.client.apiCall(`/servers/${this.id}`, { method: "DELETE" });
    }

    // ─── Channels ────────────────────────────────────────────────────────────

    /** Fetches the server's channel list from the API. */
    async fetchChannels() {
        return this.client.channels.fetchForGuild(this.id);
    }

    /**
     * Creates a new channel in the server.
     */
    async createChannel(options: {
        name: string;
        type: "TEXT" | "VOICE";
        categoryId?: string;
        isPrivate?: boolean;
        permissionOverwrites?: { id: string; type: "ROLE" | "MEMBER"; allow: bigint | string; deny: bigint | string }[];
    }) {
        const payload: any = { name: options.name, type: options.type };
        if (options.categoryId) payload.categoryId = options.categoryId;
        if (options.isPrivate !== undefined) payload.isPrivate = options.isPrivate;

        const data = await this.client.apiCall(`/servers/${this.id}/channels`, {
            method: "POST",
            body: JSON.stringify(payload),
        });

        const channel = new Channel(this.client, data.channel);
        if (options.permissionOverwrites) {
            for (const ow of options.permissionOverwrites) {
                await channel.editPermissions(ow.id, ow.type, { allow: ow.allow, deny: ow.deny });
            }
        }
        return channel;
    }

    // ─── Members ─────────────────────────────────────────────────────────────

    /**
     * Searches members by username (partial match).
     */
    async searchMembers(query: string): Promise<MemberSearchResultDTO[]> {
        const data = await this.client.apiCall(`/servers/${this.id}/members?search=${encodeURIComponent(query)}`);
        return data.members || [];
    }

    // ─── Bans ────────────────────────────────────────────────────────────────

    /** Fetches all banned users. */
    async fetchBans(): Promise<BanDTO[]> {
        const data = await this.client.apiCall(`/servers/${this.id}/bans`);
        return data.bans || [];
    }

    /** Lifts the ban of a user by their public ID. */
    async unbanMember(userId: string): Promise<void> {
        if (!this.client.getSocket()) throw new BloumeChatAuthError("unbanMember() requires an active connection — call login() first.");
        this.client.getSocket()?.emit("server:unban", { serverPublicId: this.id, userPublicId: userId });
    }

    // ─── Roles ───────────────────────────────────────────────────────────────

    /** Fetches all roles in this server. */
    async fetchRoles(): Promise<Role[]> {
        const data = await this.client.apiCall(`/servers/${this.id}/roles`);
        const roles = (data.roles || []).map((r: any) => new Role(this.client, r));
        this.roles.cache.clear();
        for (const role of roles) {
            this.roles.cache.set(role.id, role);
        }
        return roles;
    }

    /** Creates a new role. */
    async createRole(options: { name: string; color?: string; permissions?: bigint | string; hoist?: boolean }): Promise<Role> {
        const payload: any = { ...options };
        if (options.permissions !== undefined) payload.permissions = options.permissions.toString();
        const data = await this.client.apiCall(`/servers/${this.id}/roles`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
        const role = new Role(this.client, data.role);
        this.roles.cache.set(role.id, role);
        return role;
    }

    /** Edits an existing role. */
    async editRole(
        roleId: string,
        options: { name?: string; color?: string | null; permissions?: bigint | string; hoist?: boolean }
    ): Promise<Role> {
        const payload: any = { ...options };
        if (options.permissions !== undefined) payload.permissions = options.permissions.toString();
        const data = await this.client.apiCall(`/servers/${this.id}/roles/${roleId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
        const role = new Role(this.client, data.role);
        this.roles.cache.set(role.id, role);
        return role;
    }

    /** Deletes a role. */
    async deleteRole(roleId: string): Promise<void> {
        await this.client.apiCall(`/servers/${this.id}/roles/${roleId}`, { method: "DELETE" });
        this.roles.cache.delete(roleId);
    }

    // ─── Invites ─────────────────────────────────────────────────────────────

    /** Fetches all active invites. Shorthand for `guild.invites.fetchAll()`. */
    async fetchInvites(): Promise<GuildInviteDTO[]> {
        return this.invites.fetchAll();
    }

    /** Creates an invite for a specific channel. Shorthand for `guild.invites.create()`. */
    async createInvite(channelId: string, options?: { maxAge?: number; maxUses?: number }): Promise<GuildInviteDTO> {
        return this.invites.create(channelId, options);
    }

    // ─── Categories ──────────────────────────────────────────────────────────

    /** Fetches all categories (and their nested channels). */
    async fetchCategories(): Promise<Category[]> {
        const data = await this.client.apiCall(`/servers/${this.id}/categories`);
        return (data.categories || []).map((c: any) => new Category(this.client, { ...c, serverId: this.id }));
    }

    /** Creates a new category. */
    async createCategory(name: string): Promise<Category> {
        const data = await this.client.apiCall(`/servers/${this.id}/categories`, {
            method: "POST",
            body: JSON.stringify({ name }),
        });
        return new Category(this.client, { ...data.category, serverId: this.id });
    }

    // ─── Emojis ──────────────────────────────────────────────────────────────

    /** Fetches all custom emojis for this server. Shorthand for `guild.emojis.fetchAll()`. */
    async fetchEmojis(): Promise<Emoji[]> {
        return this.emojis.fetchAll();
    }

    /** Deletes a custom emoji by its public ID. Shorthand for `guild.emojis.delete()`. */
    async deleteEmoji(emojiId: string): Promise<void> {
        return this.emojis.delete(emojiId);
    }

    // ─── Audit Logs ──────────────────────────────────────────────────────────

    /**
     * Fetches the server's audit log.
     * @param options.limit Number of entries (default 50)
     * @param options.action Filter by action type
     */
    async fetchAuditLogs(options?: { limit?: number; action?: string }): Promise<AuditLogEntryDTO[]> {
        const q = new URLSearchParams();
        if (options?.limit) q.append("limit", options.limit.toString());
        if (options?.action) q.append("action", options.action);
        const data = await this.client.apiCall(`/servers/${this.id}/audit-logs?${q.toString()}`);
        return data.logs || data.auditLogs || [];
    }

    // ─── Boosts ──────────────────────────────────────────────────────────────

    /**
     * Applies one of the bot's available boosts to this server.
     * Requires the bot to have a boost credit.
     */
    async boost(): Promise<void> {
        await this.client.apiCall(`/servers/${this.id}/boost`, { method: "POST" });
    }

    // ─── Vanity URL ──────────────────────────────────────────────────────────

    /**
     * Fetches the server's vanity URL code (requires boosts).
     * Returns null if no vanity URL is set.
     */
    async fetchVanityURL(): Promise<string | null> {
        const data = await this.client.apiCall(`/servers/${this.id}/vanity`);
        return data.vanityCode || null;
    }

    // ─── Notifications & read state ──────────────────────────────────────────

    /**
     * Marks the entire server as read.
     */
    async markAsRead(): Promise<void> {
        await this.client.apiCall(`/servers/${this.id}/read`, { method: "POST" });
    }

    /**
     * Updates notification preferences for this server.
     */
    async setNotifications(settings: NotificationSettings): Promise<void> {
        await this.client.apiCall(`/servers/${this.id}/notifications`, {
            method: "PUT",
            body: JSON.stringify(settings),
        });
    }
}
