import { BaseManager } from "./BaseManager";
import { Emoji } from "../structures/Emoji";
import type { Guild } from "../structures/Guild";

/**
 * Manages cached custom emojis for a single server. Accessible via `guild.emojis`.
 */
export class EmojiManager extends BaseManager<string, Emoji> {
    public guild: Guild;

    constructor(guild: Guild) {
        super(guild.client);
        this.guild = guild;
    }

    /**
     * Fetches all custom emojis for this server.
     */
    async fetchAll(cache = true): Promise<Emoji[]> {
        const data = await this.client.apiCall(`/servers/${this.guild.id}/emojis`);
        const emojis = (data.emojis || []).map((e: any) => new Emoji(this.client, { ...e, serverId: this.guild.id }));
        if (cache) {
            this.cache.clear();
            for (const emoji of emojis) this.cache.set(emoji.id, emoji);
        }
        return emojis;
    }

    /**
     * Uploads a new custom emoji.
     * @param options.name Alphanumeric/underscore name, 2-32 characters
     * @param options.imageUrl Direct URL to the emoji image
     * @param options.isAnimated Whether the image is an animated GIF
     */
    async create(options: { name: string; imageUrl: string; isAnimated?: boolean }): Promise<Emoji> {
        const data = await this.client.apiCall(`/servers/${this.guild.id}/emojis`, {
            method: "POST",
            body: JSON.stringify(options),
        });
        const emoji = new Emoji(this.client, { ...data.emoji, serverId: this.guild.id });
        this.cache.set(emoji.id, emoji);
        return emoji;
    }

    /**
     * Deletes a custom emoji by its public ID.
     */
    async delete(emojiId: string): Promise<void> {
        await this.client.apiCall(`/servers/${this.guild.id}/emojis/${emojiId}`, { method: "DELETE" });
        this.cache.delete(emojiId);
    }
}
