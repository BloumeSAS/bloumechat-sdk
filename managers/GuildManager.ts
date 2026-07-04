import { BaseManager } from "./BaseManager";
import { Guild } from "../structures/Guild";
import { BloumeChat } from "../bloumechat";

/**
 * Manages all guilds the bot is in.
 */
export class GuildManager extends BaseManager<string, Guild> {
    constructor(client: BloumeChat) {
        super(client);
    }

    /**
     * Fetches all guilds the bot is in.
     */
    async fetchAll(cache = true): Promise<Guild[]> {
        const data = await this.client.apiCall("/servers");
        const guilds = (data.servers || []).map((s: any) => new Guild(this.client, s));
        if (cache) {
            for (const guild of guilds) {
                this.cache.set(guild.id, guild);
                // Also fetch our own member for this guild to populate permissions.
                if (this.client.user) {
                    try {
                        await this.client.members.fetch(guild.id, this.client.user.id);
                    } catch {
                        // Ignore if it fails (e.g. member record not propagated yet).
                    }
                }
            }
        }
        return guilds;
    }

    /**
     * Fetches a specific guild.
     */
    async fetch(id: string, cache = true): Promise<Guild> {
        const data = await this.client.apiCall(`/servers/${id}`);
        const guild = new Guild(this.client, data);
        if (cache) this.cache.set(guild.id, guild);
        return guild;
    }

    /**
     * Programmatically creates a new server (guild).
     * @param options The metadata for the guild.
     */
    async create(options: { name: string; iconUrl?: string | null }): Promise<Guild> {
        if (this.client.user?.bot) {
            throw new Error("Bots cannot create servers.");
        }

        const data = await this.client.apiCall("/servers", {
            method: "POST",
            body: JSON.stringify(options),
        });

        const guild = new Guild(this.client, data.server);
        this.cache.set(guild.id, guild);
        return guild;
    }
}
