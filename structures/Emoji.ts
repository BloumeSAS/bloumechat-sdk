import { Base } from "./Base";
import { BloumeChat } from "../bloumechat";

/**
 * Represents a custom emoji on a BloumeChat server.
 */
export class Emoji extends Base {
    /** Emoji public ID */
    public id: string;
    /** Emoji name (without colons) */
    public name: string;
    /** Direct URL to the emoji image */
    public url: string;
    /** ID of the server this emoji belongs to */
    public serverId: string;
    /** Whether this emoji is animated */
    public animated: boolean;

    constructor(client: BloumeChat, data: any) {
        super(client);
        this.id = data.publicId || data.id;
        this.name = data.name;
        this.url = data.url || data.imageUrl || "";
        this.serverId = data.serverPublicId || data.serverId;
        this.animated = !!data.animated;
    }

    /**
     * Returns the emoji as a usable string in messages.
     */
    toString(): string {
        return `:${this.name}:`;
    }

    /**
     * Deletes this emoji from the server.
     */
    async delete(): Promise<void> {
        await this.client.apiCall(`/servers/${this.serverId}/emojis/${this.id}`, {
            method: "DELETE",
        });
    }
}
