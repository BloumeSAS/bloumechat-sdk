import { Base } from "./Base";
import { BloumeChat } from "../bloumechat";

export interface UserProfile {
    id: string;
    username: string;
    tag: string;
    avatar: string | null;
    banner: string | null;
    bannerColor: string | null;
    bio: string | null;
    bot: boolean;
    status: string;
    followersCount: number;
    followingCount: number;
    mutualFriendsCount: number;
}

/**
 * Represents a user on BloumeChat.
 */
export class User extends Base {
    /** User's public ID (Snowflake) */
    public id: string;
    /** Username */
    public username: string;
    /** 4-digit discriminator tag */
    public tag: string;
    /** Avatar URL (null if default) */
    public avatar: string | null;
    /** Whether this account is a bot */
    public bot: boolean;
    /** Current presence status */
    public status: "online" | "idle" | "dnd" | "invisible" | "offline";

    constructor(client: BloumeChat, data: any) {
        super(client);
        this.id = data.publicId;
        this.username = data.name;
        this.tag = data.tag;
        this.avatar = data.image;
        this.bot = !!data.isBot;
        this.status = data.status || "offline";
    }

    /** Returns `Username#tag` */
    get tagString() { return `${this.username}#${this.tag}`; }

    /** Returns the user as a mention: `<@id>` */
    toString() { return `<@${this.id}>`; }

    // ─── Profile ─────────────────────────────────────────────────────────────

    /**
     * Fetches this user's full public profile.
     */
    async fetchProfile(): Promise<UserProfile> {
        const data = await this.client.apiCall(`/users/${this.id}/profile`);
        const u = data.user || data;
        return {
            id: u.publicId,
            username: u.name,
            tag: u.tag,
            avatar: u.image || null,
            banner: u.banner || null,
            bannerColor: u.bannerColor || null,
            bio: u.bio || null,
            bot: !!u.isBot,
            status: u.status || "offline",
            followersCount: u.followersCount || 0,
            followingCount: u.followingCount || 0,
            mutualFriendsCount: u.mutualFriendsCount || 0,
        };
    }

    /**
     * Fetches mutual servers with this user.
     */
    async fetchMutualServers(): Promise<any[]> {
        const data = await this.client.apiCall(`/users/${this.id}/mutual-servers`);
        return data.mutualServers || [];
    }

    /**
     * Opens a Direct Message channel with this user.
     * Returns an existing DM channel or creates a new one.
     */
    async createDM() {
        return this.client.createDM(this.id);
    }
}
