import { BaseManager } from "./BaseManager";
import { Member } from "../structures/Member";
import { BloumeChat } from "../bloumechat";

/**
 * Manages members of a guild.
 */
export class MemberManager extends BaseManager<string, Member> {
    constructor(client: BloumeChat) {
        super(client);
    }

    /**
     * Fetches members for a specific guild.
     */
    async fetchAll(serverId: string, cache = true): Promise<Member[]> {
        const data = await this.client.apiCall(`/servers/${serverId}/members`);
        const members = (data || []).map((m: any) => new Member(this.client, m));
        if (cache) {
            for (const member of members) this.cache.set(member.id, member);
        }
        return members;
    }

    /**
     * Fetches a specific member. `memberId` here is the underlying user's
     * public ID, not the membership row's own ID — same convention as every
     * `server:*` gateway payload (see `GatewayManager.removeMemberFromCache`).
     */
    async fetch(serverId: string, memberId: string, cache = true): Promise<Member> {
        const data = await this.client.apiCall(`/servers/${serverId}/members/${memberId}`);
        const member = new Member(this.client, data);
        if (cache) this.cache.set(member.id, member);
        return member;
    }

    /**
     * Returns the cached member if present, otherwise fetches it. Returns
     * `undefined` instead of throwing if the fetch fails. Cache lookups key
     * on the membership's own ID, so this only helps once the member has
     * been fetched/cached at least once under that ID — pass a user public
     * ID and it will fetch fresh instead of a cache hit.
     */
    async getOrFetch(serverId: string, memberId: string): Promise<Member | undefined> {
        const cached = [...this.cache.values()].find(m => m.serverId === serverId && (m.id === memberId || m.user.id === memberId));
        return cached ?? (await this.fetch(serverId, memberId).catch(() => undefined));
    }
}
