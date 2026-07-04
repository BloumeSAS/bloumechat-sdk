import { BaseManager } from "./BaseManager";
import { Channel } from "../structures/Channel";
import { BloumeChat } from "../bloumechat";

/**
 * Manages all channels the bot has access to.
 */
export class ChannelManager extends BaseManager<string, Channel> {
    constructor(client: BloumeChat) {
        super(client);
    }

    /**
     * Fetches channels for a specific guild.
     *
     * There is no flat GET /servers/:id/channels route (it only accepts POST
     * for channel creation) — the webapp itself builds its channel list from
     * GET /servers/:id/categories, which nests channels under each category
     * plus a separate uncategorizedChannels array. We flatten both here.
     */
    async fetchForGuild(serverId: string, cache = true): Promise<Channel[]> {
        const data = await this.client.apiCall(`/servers/${serverId}/categories`);
        const fromCategories = (data?.categories || []).flatMap((cat: any) => cat.channels || []);
        const uncategorized = data?.uncategorizedChannels || [];
        const channels = [...fromCategories, ...uncategorized].map((c: any) => new Channel(this.client, { ...c, serverId }));
        if (cache) {
            for (const channel of channels) this.cache.set(channel.id, channel);
        }
        return channels;
    }

    /**
     * Fetches a specific channel.
     */
    async fetch(id: string, cache = true): Promise<Channel> {
        const data = await this.client.apiCall(`/channels/${id}`);
        const channel = new Channel(this.client, data);
        if (cache) this.cache.set(channel.id, channel);
        return channel;
    }
}
