import { BaseManager } from "./BaseManager";
import { Role } from "../structures/Role";
import type { Guild } from "../structures/Guild";

/**
 * Manages API methods for roles and stores their cache.
 */
export class RoleManager extends BaseManager<string, Role> {
    public guild: Guild;

    constructor(guild: Guild) {
        super(guild.client);
        this.guild = guild;
    }

    /**
     * Resolves a role object from its ID or object.
     */
    resolve(role: string | Role): Role | undefined {
        if (role instanceof Role) return role;
        if (typeof role === "string") return this.cache.get(role) || undefined;
        return undefined;
    }

    /**
     * Returns the cached role if present, otherwise re-fetches all of the
     * guild's roles (there's no single-role fetch endpoint) and returns the
     * matching one. Returns `undefined` instead of throwing if the fetch fails
     * or the role doesn't exist.
     */
    async getOrFetch(roleId: string): Promise<Role | undefined> {
        if (this.cache.has(roleId)) return this.cache.get(roleId);
        const roles = await this.guild.fetchRoles().catch(() => []);
        return roles.find(r => r.id === roleId);
    }

    /**
     * Creates a new role in the guild.
     */
    async create(options: { name: string; color?: string; permissions?: bigint | string; hoist?: boolean }): Promise<Role> {
        const payload: any = { ...options };
        if (options.permissions !== undefined) payload.permissions = options.permissions.toString();

        const data = await this.client.apiCall(`/servers/${this.guild.id}/roles`, {
            method: "POST",
            body: JSON.stringify(payload),
        });

        const role = new Role(this.client, data.role);
        this.cache.set(role.id, role);
        return role;
    }

    /**
     * Deletes a role from the guild.
     */
    async delete(roleId: string): Promise<void> {
        await this.client.apiCall(`/servers/${this.guild.id}/roles/${roleId}`, {
            method: "DELETE",
        });
        this.cache.delete(roleId);
    }
}
