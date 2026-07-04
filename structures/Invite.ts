import { Base } from "./Base";
import { BloumeChat } from "../bloumechat";

export interface InviteGuildData {
    publicId: string;
    name: string;
    imageUrl: string | null;
    memberCount: number;
    isMember: boolean;
    channelPublicId: string | null;
}

/**
 * Represents a server invite on BloumeChat.
 */
export class Invite extends Base {
    /** Invite code */
    public code: string;
    /** Guild information attached to this invite */
    public guild: InviteGuildData;

    constructor(client: BloumeChat, code: string, data: any) {
        super(client);
        this.code = code;
        this.guild = data.server || data.guild;
    }

    /**
     * Revokes (deletes) this invite. Requires MANAGE_INVITES permission.
     */
    async revoke(): Promise<void> {
        await this.client.apiCall(`/invites/${this.code}`, {
            method: "DELETE",
        });
    }
}
