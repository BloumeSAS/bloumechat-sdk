import { Base } from "./Base";
import { BloumeChat } from "../bloumechat";
import { Channel } from "./Channel";
import type { PermissionOverrideDTO } from "./dto";

/**
 * Represents a channel category on BloumeChat.
 */
export class Category extends Base {
    /** Category public ID */
    public id: string;
    /** Category name */
    public name: string;
    /** Display order position */
    public position: number;
    /** ID of the parent server */
    public serverId: string;
    /** Whether this category is private */
    public isPrivate: boolean;
    /** Channels nested inside this category */
    public channels: Channel[];

    constructor(client: BloumeChat, data: any) {
        super(client);
        this.id = data.publicId || data.id;
        this.name = data.name;
        this.position = typeof data.position === "number" ? data.position : 0;
        this.serverId = data.serverPublicId || data.serverId || "";
        this.isPrivate = !!data.isPrivate;
        this.channels = Array.isArray(data.channels)
            ? data.channels.map((c: any) => new Channel(client, { ...c, serverId: this.serverId }))
            : [];
    }

    /**
     * Renames the category.
     */
    async setName(name: string): Promise<void> {
        await this.edit({ name });
    }

    /**
     * Edits the category (name, isPrivate).
     */
    async edit(data: { name?: string; isPrivate?: boolean }): Promise<void> {
        await this.client.apiCall(`/servers/${this.serverId}/categories/${this.id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        if (data.name !== undefined) this.name = data.name;
        if (data.isPrivate !== undefined) this.isPrivate = data.isPrivate;
    }

    /**
     * Deletes this category.
     * Channels inside become uncategorized.
     */
    async delete(): Promise<void> {
        await this.client.apiCall(`/servers/${this.serverId}/categories/${this.id}`, {
            method: "DELETE",
        });
    }

    /**
     * Syncs all channels in this category to inherit the category's permission overrides.
     */
    async syncPermissions(): Promise<void> {
        await this.client.apiCall(`/servers/${this.serverId}/categories/${this.id}/sync`, {
            method: "POST",
        });
    }

    /**
     * Fetches the category's permission overrides.
     */
    async fetchPermissionOverrides(): Promise<PermissionOverrideDTO[]> {
        const data = await this.client.apiCall(`/servers/${this.serverId}/categories/${this.id}/overrides`);
        return data.overrides || [];
    }
}
