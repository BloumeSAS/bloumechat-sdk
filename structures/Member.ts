import { Base } from "./Base";
import { BloumeChat } from "../bloumechat";
import { User } from "./User";
import { PermissionFlags, ALL_PERMISSIONS } from "../util/Permissions";

/**
 * Represents a member of a server.
 */
export class Member extends Base {
    public id: string;
    public user: User;
    public serverId: string;
    public roles: any[];
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
     * Kicks the member from the server.
     */
    async kick(reason?: string) {
        await this.client.apiCall(`/servers/${this.serverId}/members/${this.id}`, {
            method: "DELETE",
            body: JSON.stringify({ reason })
        });
    }

    /**
     * Bans the member from the server.
     */
    async ban(options?: { reason?: string; deleteMessageDays?: number }) {
        await this.client.apiCall(`/servers/${this.serverId}/bans/${this.id}`, {
            method: "PUT",
            body: JSON.stringify(options)
        });
    }

    /**
     * Edits the member (e.g., roles, nickname).
     */
    async edit(data: { roles?: string[]; nickname?: string | null }) {
        await this.client.apiCall(`/servers/${this.serverId}/members/${this.id}`, {
            method: "PATCH",
            body: JSON.stringify(data)
        });
        if (data.roles) this.roles = data.roles;
    }

    /**
     * Set the member's nickname.
     */
    async setNickname(nickname: string | null) {
        return this.edit({ nickname });
    }

    /**
     * Adds a role to the member.
     */
    async addRole(roleId: string) {
        const currentRoleIds = this.roles.map(r => r.id || r.publicId || r);
        if (currentRoleIds.includes(roleId)) return;
        return this.edit({ roles: [...currentRoleIds, roleId] });
    }

    /**
     * Removes a role from the member.
     */
    async removeRole(roleId: string) {
        const currentRoleIds = this.roles.map(r => r.id || r.publicId || r);
        if (!currentRoleIds.includes(roleId)) return;
        return this.edit({ roles: currentRoleIds.filter(id => id !== roleId) });
    }
}
