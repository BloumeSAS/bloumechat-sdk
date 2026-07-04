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
     * Fetches a specific member.
     */
    async fetch(serverId: string, memberId: string, cache = true): Promise<Member> {
        const data = await this.client.apiCall(`/servers/${serverId}/members/${memberId}`);
        const member = new Member(this.client, data);
        if (cache) this.cache.set(member.id, member);
        return member;
    }
}
