import { Channel } from "./Channel";
import { User } from "./User";
import { BloumeChat } from "../bloumechat";

/**
 * Represents a Direct Message channel between two users.
 * Extends Channel — all Channel methods (send, fetchMessages, …) work here.
 */
export class DMChannel extends Channel {
    /** Public ID of the recipient */
    public recipientId: string;
    /** Recipient User object (may be null if not yet fetched) */
    public recipient: User | null;
    /** Current friendship status with the recipient */
    public friendshipStatus: "ACCEPTED" | "PENDING" | "NONE";
    /** Friendship record ID (if a friendship exists) */
    public friendshipId: string | undefined;

    constructor(client: BloumeChat, data: any) {
        super(client, {
            publicId: data.publicId,
            id: data.publicId,
            name: data.recipient?.name || "DM",
            type: "DM",
            serverId: null,
        });
        this.recipientId = data.recipient?.publicId || "";
        this.friendshipStatus = data.recipient?.friendshipStatus || "NONE";
        this.friendshipId = data.recipient?.friendshipId;

        if (data.recipient) {
            this.recipient = new User(client, data.recipient);
            client.users.cache.set(this.recipient.id, this.recipient);
        } else {
            this.recipient = null;
        }
    }

    /**
     * Fetches the recipient's full profile.
     */
    async fetchRecipient(): Promise<User> {
        const data = await this.client.apiCall(`/users/${this.recipientId}/profile`);
        const user = new User(this.client, data.user || data);
        this.recipient = user;
        this.client.users.cache.set(user.id, user);
        return user;
    }
}
