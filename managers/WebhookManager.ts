import { BaseManager } from "./BaseManager";
import { Webhook } from "../structures/Webhook";
import type { Channel } from "../structures/Channel";

/**
 * Manages cached webhooks for a single channel. Accessible via `channel.webhooks`.
 */
export class WebhookManager extends BaseManager<string, Webhook> {
    public channel: Channel;

    constructor(channel: Channel) {
        super(channel.client);
        this.channel = channel;
    }

    /**
     * Fetches all webhooks for this channel.
     */
    async fetchAll(cache = true): Promise<Webhook[]> {
        const data = await this.client.apiCall(`/channels/${this.channel.id}/webhooks`);
        const webhooks = (data.webhooks || []).map((w: any) => new Webhook(this.client, { ...w, channelId: this.channel.id }));
        if (cache) {
            this.cache.clear();
            for (const webhook of webhooks) this.cache.set(webhook.id, webhook);
        }
        return webhooks;
    }

    /**
     * Creates a webhook in this channel.
     * @param options.name Webhook display name
     * @param options.avatarUrl Avatar image URL (optional)
     */
    async create(options: { name: string; avatarUrl?: string }): Promise<Webhook> {
        const data = await this.client.apiCall(`/channels/${this.channel.id}/webhooks`, {
            method: "POST",
            body: JSON.stringify(options),
        });
        const webhook = new Webhook(this.client, { ...data.webhook, channelId: this.channel.id });
        this.cache.set(webhook.id, webhook);
        return webhook;
    }

    /**
     * Deletes a webhook by its public ID.
     */
    async delete(webhookId: string): Promise<void> {
        await this.client.apiCall(`/channels/${this.channel.id}/webhooks/${webhookId}`, { method: "DELETE" });
        this.cache.delete(webhookId);
    }
}
