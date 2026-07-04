import { Base } from "./Base";
import { BloumeChat } from "../bloumechat";
import { User } from "./User";
import type { Member } from "./Member";
import { EmbedBuilder, EmbedPayload } from "./EmbedBuilder";

/**
 * Represents a message on BloumeChat.
 */
export class Message extends Base {
    public id: string;
    public content: string;
    public author: User;
    public channelId: string;
    public serverId?: string;
    public createdAt: Date;
    public nonce?: string;
    public embeds: any[];
    public rawData: any;
    public fileUrl: string | null;

    constructor(client: BloumeChat, data: any) {
        super(client);
        this.id = data.publicId;
        // The server HTML-escapes message content at write time (XSS protection),
        // so the API always returns &lt;/&gt;/&amp; instead of raw <, >, & — decode
        // here so bot regexes/mention-parsers see the original characters.
        this.content = data.content ? data.content.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") : "";
        this.author = client.users.cache.get(data.author?.publicId) || new User(client, data.author);
        this.channelId = data.channelPublicId;
        this.serverId = data.serverPublicId;
        this.createdAt = new Date(data.createdAt);
        this.nonce = data.nonce;
        this.embeds = data.embeds || [];
        this.rawData = data;
        this.fileUrl = data.fileUrl || null;
    }

    /**
     * The channel the message was sent in.
     */
    /**
     * The channel the message was sent in.
     */
    get channel() {
        const ChannelClass = require("./Channel").Channel;
        return (
            this.client.channels.cache.get(this.channelId) ||
            new ChannelClass(this.client, {
                id: this.channelId,
                publicId: this.channelId,
                serverId: this.serverId,
            })
        );
    }

    /**
     * The guild the message was sent in.
     */
    get guild() {
        if (!this.serverId) return null;
        return this.client.guilds.cache.get(this.serverId);
    }

    /**
     * The server member who sent this message (cached only — call
     * `client.members.fetch(serverId, userId)` first if it isn't cached yet).
     * Member.id is the membership's own publicId, not the user's, so this
     * looks up by (serverId, user.id) rather than a direct cache.get().
     */
    get member(): Member | null {
        if (!this.serverId) return null;
        return this.client.members.cache.find((m: any) => m.serverId === this.serverId && m.user?.id === this.author.id) || null;
    }

    /**
     * Replies to the message.
     */
    async reply(content: string | { content?: string; embeds?: any[] }, embeds?: any[]) {
        if (typeof content === "string") {
            return this.client.sendMessage(this.channelId, { content, embeds, replyToId: this.id });
        }
        return this.client.sendMessage(this.channelId, { ...content, replyToId: this.id });
    }

    /**
     * Edits the message.
     */
    async edit(
        options: string | EmbedBuilder | { content?: string; embeds?: Array<EmbedBuilder | EmbedPayload | Record<string, unknown>> }
    ): Promise<Message> {
        if (!this.client.getSocket()) throw new Error("Not connected");

        let content = "";
        let embeds: Array<EmbedPayload | Record<string, unknown>> = [];

        if (typeof options === "string") {
            content = options;
        } else if (options instanceof EmbedBuilder) {
            embeds = [options.toJSON()];
        } else {
            content = options.content ?? "";
            embeds = (options.embeds || []).map((e: any) =>
                e instanceof EmbedBuilder ? e.toJSON() : (e as EmbedPayload | Record<string, unknown>)
            );
        }

        this.client.getSocket()?.emit("message:edit", { messagePublicId: this.id, content, embeds });
        this.content = content;
        this.embeds = embeds;
        return this;
    }

    /**
     * Deletes the message.
     */
    async delete() {
        if (!this.client.getSocket()) throw new Error("Not connected");
        this.client.getSocket()?.emit("message:delete", { messagePublicId: this.id });
    }

    /**
     * Reacts to the message with an emoji.
     */
    async react(emoji: string) {
        const socket = this.client.getSocket();
        if (!socket) throw new Error("Not connected");
        socket.emit("message:react", { messagePublicId: this.id, emoji });
    }

    /**
     * Pins the message to the channel.
     */
    async pin() {
        await this.client.apiCall(`/chat/${this.channelId}/pin/${this.id}`, {
            method: "POST",
        });
    }

    /**
     * Unpins the message from the channel.
     */
    async unpin() {
        await this.client.apiCall(`/chat/${this.channelId}/pin/${this.id}`, {
            method: "DELETE",
        });
    }

    /**
     * Fetches detailed information about users who reacted with a specific emoji.
     */
    async fetchReactions(emoji: string) {
        // Needs URL-encoding because emojis can contain special characters
        const urlEmoji = encodeURIComponent(emoji);
        const data = await this.client.apiCall(`/chat/${this.channelId}/reactions/${this.id}/details?emoji=${urlEmoji}`, {
            method: "GET",
        });
        return data.reactions; // Returns array of objects { userPublicId, userName, userImage }
    }

    /**
     * Clears all reactions from the message.
     */
    async clearReactions() {
        if (!this.client.getSocket()) throw new Error("Not connected");
        this.client.getSocket()?.emit("message:reaction_clear", { messagePublicId: this.id });
    }

    /**
     * Awaits reactions on the message.
     * @param options max the maximum number of reactions, time the maximum time to wait in ms
     */
    awaitReactions(options: { max?: number; time?: number } = {}): Promise<any> {
        return new Promise(resolve => {
            const timeout = options.time
                ? setTimeout(() => {
                      this.client.off("messageReactionAdd", onReact);
                      resolve(null);
                  }, options.time)
                : null;

            let count = 0;
            const onReact = (data: any) => {
                if (data.messagePublicId === this.id) {
                    count++;
                    if (options.max && count >= options.max) {
                        if (timeout) clearTimeout(timeout);
                        this.client.off("messageReactionAdd", onReact);
                        resolve(data);
                    }
                }
            };

            this.client.on("messageReactionAdd", onReact);
        });
    }
}
