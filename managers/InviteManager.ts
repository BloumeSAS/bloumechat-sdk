import { BaseManager } from "./BaseManager";
import type { Guild } from "../structures/Guild";
import type { GuildInviteDTO } from "../structures/dto";

/**
 * Manages cached invites for a single server. Accessible via `guild.invites`.
 *
 * Caches by invite `code` (invites don't have a separate publicId — the code
 * itself is the unique identifier used everywhere, including for revocation).
 */
export class InviteManager extends BaseManager<string, GuildInviteDTO> {
    public guild: Guild;

    constructor(guild: Guild) {
        super(guild.client);
        this.guild = guild;
    }

    /**
     * Fetches all active invites for this server.
     */
    async fetchAll(cache = true): Promise<GuildInviteDTO[]> {
        // `all=true` is required for the API to return the full server-wide invite
        // list — without it, the endpoint returns only the caller's own invite.
        const data = await this.client.apiCall(`/servers/${this.guild.id}/invites?all=true`);
        const invites: GuildInviteDTO[] = data.invites || [];
        if (cache) {
            this.cache.clear();
            for (const invite of invites) this.cache.set(invite.code, invite);
        }
        return invites;
    }

    /**
     * Creates an invite for a specific channel in this server.
     */
    async create(channelId: string, options?: { maxAge?: number; maxUses?: number }): Promise<GuildInviteDTO> {
        const data = await this.client.apiCall(`/servers/${this.guild.id}/invites`, {
            method: "POST",
            body: JSON.stringify({ channelPublicId: channelId, ...options }),
        });
        const invite: GuildInviteDTO = data.invite;
        this.cache.set(invite.code, invite);
        return invite;
    }

    /**
     * Revokes (deletes) an invite by its code. Requires MANAGE_INVITES.
     */
    async delete(code: string): Promise<void> {
        await this.client.apiCall(`/invites/${code}`, { method: "DELETE" });
        this.cache.delete(code);
    }
}
