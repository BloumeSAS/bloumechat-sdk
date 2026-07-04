import { Base } from "./Base";
import { BloumeChat } from "../bloumechat";
import type { EmbedPayload } from "./EmbedBuilder";
import { BloumeChatAuthError } from "../errors/BloumeChatAuthError";
import { BloumeChatAPIError } from "../errors/BloumeChatAPIError";

export interface WebhookMessageOptions {
    content?: string;
    username?: string;
    avatarUrl?: string;
    embeds?: Array<EmbedPayload | Record<string, unknown>>;
}

/** Response returned by {@link Webhook.send}. */
export interface WebhookSendResult {
    id: string;
}

/**
 * Represents a channel webhook on BloumeChat.
 */
export class Webhook extends Base {
    /** Webhook public ID */
    public id: string;
    /** Webhook name */
    public name: string;
    /** Webhook avatar URL */
    public avatar: string | null;
    /** ID of the channel this webhook belongs to */
    public channelId: string;
    /**
     * Webhook secret token (only available on creation or fetch with token).
     * Non-enumerable — kept out of `console.log(webhook)` / `JSON.stringify(webhook)`
     * output since this token alone is enough to post messages as the webhook.
     */
    public token: string | null = null;

    constructor(client: BloumeChat, data: any) {
        super(client);
        this.id = data.publicId || data.id;
        this.name = data.name;
        this.avatar = data.avatarUrl || data.avatar || null;
        this.channelId = data.channelPublicId || data.channelId;
        Object.defineProperty(this, "token", {
            value: data.token || null,
            writable: true,
            enumerable: false,
            configurable: false,
        });
    }

    /** Redact the token in default Node.js console output (`console.log(webhook)`). */
    private [Symbol.for("nodejs.util.inspect.custom")]() {
        return { ...this, token: this.token ? "[REDACTED]" : null };
    }

    /** Redact the token if a consumer does `JSON.stringify(webhook)`. */
    toJSON() {
        return { ...this, token: this.token ? "[REDACTED]" : null };
    }

    /**
     * The full webhook URL (requires token).
     */
    get url(): string | null {
        if (!this.token) return null;
        return `${this.client.baseUrl.replace("/api/v2", "")}/webhooks/${this.id}/${this.token}`;
    }

    /**
     * Sends a message through this webhook.
     * Requires the token to be available.
     */
    async send(options: string | WebhookMessageOptions): Promise<WebhookSendResult> {
        if (!this.token) throw new BloumeChatAuthError("Webhook token is not available. Fetch the webhook with token first.");

        const payload: WebhookMessageOptions = typeof options === "string" ? { content: options } : options;

        const res = await fetch(`${this.client.baseUrl}/webhooks/${this.id}/${this.token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
            const body = await res.text();
            throw new BloumeChatAPIError(res.status, `/webhooks/${this.id}/${this.token}`, body);
        }
        return res.json();
    }

    /**
     * Edits this webhook (name, avatar).
     */
    async edit(data: { name?: string; avatarUrl?: string | null }): Promise<void> {
        await this.client.apiCall(`/channels/${this.channelId}/webhooks/${this.id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        if (data.name) this.name = data.name;
        if (data.avatarUrl !== undefined) this.avatar = data.avatarUrl;
    }

    /**
     * Deletes this webhook.
     */
    async delete(): Promise<void> {
        await this.client.apiCall(`/channels/${this.channelId}/webhooks/${this.id}`, {
            method: "DELETE",
        });
    }
}
