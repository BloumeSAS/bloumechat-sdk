import { Base } from "./Base";
import { BloumeChat } from "../bloumechat";

export type NotificationType = "MENTION" | "REPLY" | "FRIEND_REQUEST" | "FRIEND_ACCEPTED" | "SERVER_INVITE" | "SYSTEM";

/**
 * Represents an unread notification on BloumeChat.
 */
export class Notification extends Base {
    /** Notification public ID */
    public id: string;
    /** Notification type */
    public type: NotificationType;
    /** Whether this notification has been read */
    public read: boolean;
    /** Raw data payload attached to this notification */
    public data: Record<string, any>;
    /** When this notification was created */
    public createdAt: Date;

    constructor(client: BloumeChat, raw: any) {
        super(client);
        this.id = raw.publicId || raw.id;
        this.type = raw.type;
        this.read = !!raw.read;
        this.data = raw.data || {};
        this.createdAt = new Date(raw.createdAt);
    }
}
