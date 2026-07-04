import { Base } from "./Base";
import { BloumeChat } from "../bloumechat";
import { Message } from "./Message";
import { BloumeChatAuthError } from "../errors/BloumeChatAuthError";
import type { EmbedBuilder, EmbedPayload } from "./EmbedBuilder";
import type { Webhook } from "./Webhook";
import type { GuildInviteDTO, PermissionOverrideDTO } from "./dto";

export type { GuildInviteDTO, PermissionOverrideDTO } from "./dto";

export interface MessageSearchOptions {
    limit?: number;
    before?: string;
    after?: string;
}

/**
 * Represents a text or voice channel on BloumeChat.
 */
export class Channel extends Base {
    /** Channel public ID (Snowflake) */
    public id: string;
    /** Channel name */
    public name: string;
    /** Channel type (TEXT, VOICE, DM, GROUP_DM, ANNOUNCEMENT…) */
    public type: string;
    /** ID of the parent server (null for DMs/groups) */
    public serverId: string | null;

    constructor(client: BloumeChat, data: any) {
        super(client);
        this.id = data.publicId || data.id;
        this.name = data.name;
        this.type = data.type;
        this.serverId = data.serverPublicId || data.serverId || null;
    }

    // ─── Messaging ───────────────────────────────────────────────────────────

    /**
     * Sends a message to this channel.
     */
    async send(
        content: string | { content?: string; embeds?: Array<EmbedBuilder | EmbedPayload | Record<string, unknown>>; replyToId?: string },
        embeds?: Array<EmbedBuilder | EmbedPayload | Record<string, unknown>>
    ): Promise<Message> {
        if (typeof content === "string") {
            return this.client.sendMessage(this.id, { content, embeds });
        }
        return this.client.sendMessage(this.id, content);
    }

    /**
     * Fetches messages from this channel.
     * @param limit Number of messages to retrieve (default 50, max 100)
     * @param before Fetch messages before this message ID
     */
    async fetchMessages(limit = 50, before?: string): Promise<Message[]> {
        const q = new URLSearchParams({ limit: limit.toString() });
        if (before) q.append("before", before);
        const data = await this.client.apiCall(`/chat/${this.id}?${q.toString()}`);
        return (data.messages || []).map((m: any) => new Message(this.client, m));
    }

    /**
     * Deletes multiple messages at once (requires MANAGE_MESSAGES).
     */
    async bulkDelete(messageIds: string[]): Promise<void> {
        await this.client.apiCall(`/channels/${this.id}/messages/bulk-delete`, {
            method: "POST",
            body: JSON.stringify({ messageIds }),
        });
    }

    /**
     * Searches messages in this channel.
     */
    async search(query: string, options?: MessageSearchOptions): Promise<Message[]> {
        const q = new URLSearchParams({ q: query });
        if (options?.limit) q.append("limit", options.limit.toString());
        if (options?.before) q.append("before", options.before);
        if (options?.after) q.append("after", options.after);
        const data = await this.client.apiCall(`/chat/${this.id}/search?${q.toString()}`);
        return (data.messages || []).map((m: any) => new Message(this.client, m));
    }

    /**
     * Fetches pinned messages in this channel.
     */
    async fetchPins(): Promise<Message[]> {
        const data = await this.client.apiCall(`/chat/${this.id}/pins`);
        return (data.pins || []).map((m: any) => new Message(this.client, m));
    }

    // ─── Typing ──────────────────────────────────────────────────────────────

    /**
     * Emits a typing start indicator in this channel.
     */
    sendTyping(): void {
        if (!this.client.getSocket()) throw new BloumeChatAuthError("sendTyping() requires an active connection — call login() first.");
        this.client.getSocket()?.emit("typing:start", this.id);
    }

    /**
     * Stops the typing indicator in this channel.
     */
    stopTyping(): void {
        if (!this.client.getSocket()) throw new BloumeChatAuthError("stopTyping() requires an active connection — call login() first.");
        this.client.getSocket()?.emit("typing:stop", this.id);
    }

    // ─── Channel management ──────────────────────────────────────────────────

    /**
     * Edits this channel (name, description).
     */
    async edit(data: { name?: string; description?: string | null }): Promise<void> {
        await this.client.apiCall(`/channels/${this.id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        if (data.name) this.name = data.name;
    }

    /** Renames this channel. */
    async setName(name: string): Promise<void> {
        return this.edit({ name });
    }

    /** Deletes this channel. */
    async delete(): Promise<void> {
        await this.client.apiCall(`/channels/${this.id}`, { method: "DELETE" });
    }

    /**
     * Duplicates this channel (copies permissions and settings).
     */
    async duplicate(): Promise<Channel> {
        const data = await this.client.apiCall(`/channels/${this.id}/duplicate`, { method: "POST" });
        return new Channel(this.client, data.channel);
    }

    // ─── Invites ─────────────────────────────────────────────────────────────

    /**
     * Creates an invite to this channel.
     */
    async createInvite(options?: { maxAge?: number; maxUses?: number }): Promise<GuildInviteDTO> {
        const data = await this.client.apiCall(`/servers/${this.serverId}/invites`, {
            method: "POST",
            body: JSON.stringify({ channelPublicId: this.id, ...options }),
        });
        return data.invite;
    }

    // ─── Permissions ─────────────────────────────────────────────────────────

    /**
     * Fetches all permission overrides for this channel.
     */
    async fetchPermissionOverrides(): Promise<PermissionOverrideDTO[]> {
        const data = await this.client.apiCall(`/channels/${this.id}/overrides`);
        return data.overrides || [];
    }

    /**
     * Creates or updates a permission override for a role or member.
     */
    async editPermissions(
        targetId: string,
        type: "ROLE" | "MEMBER",
        options: { allow: bigint | string; deny: bigint | string }
    ): Promise<void> {
        await this.client.apiCall(`/channels/${this.id}/overrides`, {
            method: "POST",
            body: JSON.stringify({
                targetId,
                type,
                allow: options.allow.toString(),
                deny: options.deny.toString(),
            }),
        });
    }

    /**
     * Deletes a permission override by its ID.
     */
    async deletePermissionOverride(overrideId: string): Promise<void> {
        await this.client.apiCall(`/channels/${this.id}/overrides/${overrideId}`, {
            method: "DELETE",
        });
    }

    /**
     * Syncs this channel's permissions with its parent category.
     */
    async syncPermissions(): Promise<void> {
        await this.client.apiCall(`/channels/${this.id}/sync`, { method: "POST" });
    }

    // ─── Webhooks ────────────────────────────────────────────────────────────

    /**
     * Fetches all webhooks for this channel.
     */
    async fetchWebhooks(): Promise<Webhook[]> {
        const { Webhook } = require("./Webhook");
        const data = await this.client.apiCall(`/channels/${this.id}/webhooks`);
        return (data.webhooks || []).map((w: any) => new Webhook(this.client, { ...w, channelId: this.id }));
    }

    /**
     * Creates a webhook in this channel.
     * @param options.name Webhook display name
     * @param options.avatarUrl Avatar image URL (optional)
     */
    async createWebhook(options: { name: string; avatarUrl?: string }): Promise<Webhook> {
        const { Webhook } = require("./Webhook");
        const data = await this.client.apiCall(`/channels/${this.id}/webhooks`, {
            method: "POST",
            body: JSON.stringify(options),
        });
        return new Webhook(this.client, { ...data.webhook, channelId: this.id });
    }
}
