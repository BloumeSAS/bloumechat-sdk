import { BaseManager } from "./BaseManager";
import { User } from "../structures/User";
import { BloumeChat } from "../bloumechat";

/**
 * Manages all users on BloumeChat.
 */
export class UserManager extends BaseManager<string, User> {
    constructor(client: BloumeChat) {
        super(client);
    }

    /**
     * Fetches a user from the API.
     */
    async fetch(id: string, cache = true): Promise<User> {
        const data = await this.client.apiCall(`/users/${id}`);
        const user = new User(this.client, data);
        if (cache) this.cache.set(user.id, user);
        return user;
    }
}
