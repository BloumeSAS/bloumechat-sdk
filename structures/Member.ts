import { Base } from "./Base";
import { BloumeChat } from "../bloumechat";
import { User } from "./User";
import { PermissionFlags, ALL_PERMISSIONS } from "../util/Permissions";
import { BloumeChatAuthError } from "../errors/BloumeChatAuthError";
import { emitWithAck } from "../gateway/emitWithAck";
import type { Message } from "./Message";
import type { EmbedBuilder, EmbedPayload } from "./EmbedBuilder";
import type { MemberRoleRef } from "./dto";
import type { VoiceState } from "../voice/types";

export type { MemberRoleRef } from "./dto";

/**
 * Represents a member of a server.
 */
export class Member extends Base {
    public id: string;
    public user: User;
    public serverId: string;
    /**
     * Roles attached to this member. Entries are normally full role objects
     * (`{ id, permissions, ... }`), but `addRole`/`removeRole` also accept a
     * bare role ID string in this array — hence the union.
     */
    public roles: Array<MemberRoleRef | string>;
    public joinedAt: Date;

    constructor(client: BloumeChat, data: any) {
        super(client);
        this.id = data.publicId;
        this.user = client.users.cache.get(data.userId || data.user?.publicId) || new User(client, data.user || data);
        this.serverId = data.serverPublicId || data.serverId;
        this.roles = data.roles || [];
        this.joinedAt = new Date(data.joinedAt);
    }

    /**
     * The permissions of this member in the server (ignoring channel overrides for now).
     */
    get permissions(): bigint {
        const guild = this.client.guilds.cache.get(this.serverId);
        if (!guild) return 0n;

        // Owner has all permissions
        if (guild.ownerId === this.user.id) return ALL_PERMISSIONS;

        let permissions = 0n;

        // Add permissions from roles
        // We expect roles to be populated with their permissions from the API
        for (const role of this.roles) {
            if (typeof role === "string") continue;
            permissions |= BigInt(role.permissions || 0);
        }

        // Administrator bypass
        if ((permissions & PermissionFlags.ADMINISTRATOR) === PermissionFlags.ADMINISTRATOR) {
            return ALL_PERMISSIONS;
        }

        return permissions;
    }

    /**
     * Checks if the member has a specific permission.
     */
    hasPermission(permission: bigint): boolean {
        return (this.permissions & permission) === permission;
    }

    /**
     * This member's current voice channel state, or `undefined` if they're
     * not known to be in a voice channel (backed by `client.voiceStates`).
     */
    get voice(): VoiceState | undefined {
        return this.client.voiceStates.cache.get(this.user.id);
    }

    /**
     * Kicks the member from the server. There is no REST endpoint for this —
     * kicking (like the human "Kick" button) happens over the same
     * `server:kick` Socket.IO event the web app uses, requiring an active
     * connection (`login()`).
     *
     * `reason` isn't currently persisted server-side for kicks (only bans
     * accept one) — kept in the signature for API symmetry with `ban()`.
     */
    async kick(_reason?: string): Promise<void> {
        const socket = this.client.getSocket();
        if (!socket) throw new BloumeChatAuthError("kick() requires an active connection — call login() first.");
        await emitWithAck(socket, "server:kick", { serverPublicId: this.serverId, userPublicId: this.user.id });
    }

    /**
     * Bans the member from the server, over the same `server:ban` Socket.IO
     * event the web app uses (there is no REST endpoint for this).
     * @param options.deleteHistory How much of the banned user's recent message history to also delete.
     */
    async ban(options?: { reason?: string; deleteHistory?: "none" | "1d" | "7d" | "14d" | "30d" }): Promise<void> {
        const socket = this.client.getSocket();
        if (!socket) throw new BloumeChatAuthError("ban() requires an active connection — call login() first.");
        await emitWithAck(socket, "server:ban", {
            serverPublicId: this.serverId,
            userPublicId: this.user.id,
            reason: options?.reason,
            deleteHistory: options?.deleteHistory,
        });
    }

    /**
     * Edits the member (e.g., roles, nickname).
     */
    async edit(data: { roles?: string[]; nickname?: string | null }): Promise<void> {
        await this.client.apiCall(`/servers/${this.serverId}/members/${this.user.id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        if (data.roles) this.roles = data.roles;
    }

    /**
     * Set the member's nickname.
     */
    async setNickname(nickname: string | null): Promise<void> {
        return this.edit({ nickname });
    }

    private roleIds(): string[] {
        return this.roles.map(r => (typeof r === "string" ? r : (r.id ?? r.publicId ?? ""))).filter(Boolean);
    }

    /**
     * Adds a role to the member.
     */
    async addRole(roleId: string): Promise<void> {
        const currentRoleIds = this.roleIds();
        if (currentRoleIds.includes(roleId)) return;
        return this.edit({ roles: [...currentRoleIds, roleId] });
    }

    /**
     * Removes a role from the member.
     */
    async removeRole(roleId: string): Promise<void> {
        const currentRoleIds = this.roleIds();
        if (!currentRoleIds.includes(roleId)) return;
        return this.edit({ roles: currentRoleIds.filter(id => id !== roleId) });
    }

    /**
     * Whether this member has the given role, matched by ID or (case-insensitive)
     * name. Name matching requires the guild's role cache to be populated —
     * call `guild.fetchRoles()` at least once first if roles were never fetched.
     */
    hasRole(roleIdOrName: string): boolean {
        const ids = this.roleIds();
        if (ids.includes(roleIdOrName)) return true;

        const guild = this.client.guilds.cache.get(this.serverId);
        if (!guild) return false;
        const match = [...guild.roles.cache.values()].find(r => r.name.toLowerCase() === roleIdOrName.toLowerCase());
        return match ? ids.includes(match.id) : false;
    }

    /** Whether this member is the server's owner. */
    get isOwner(): boolean {
        const guild = this.client.guilds.cache.get(this.serverId);
        return guild ? guild.ownerId === this.user.id : false;
    }

    /**
     * Sends this member a Direct Message — shorthand for
     * `member.user.createDM()` followed by sending on the resulting channel.
     */
    async send(
        content:
            | string
            | EmbedBuilder
            | { content?: string; embeds?: Array<EmbedBuilder | EmbedPayload | Record<string, unknown>>; replyToId?: string }
    ): Promise<Message> {
        const dm = await this.user.createDM();
        return this.client.sendMessage(dm.id, content);
    }
}
