import { Base } from "./Base";
import { BloumeChat } from "../bloumechat";
import { PermissionFlags } from "../util/Permissions";

/**
 * Represents a role on BloumeChat.
 */
export class Role extends Base {
    public id: string;
    public name: string;
    public color: string | null;
    public hoist: boolean;
    public serverId: string;
    public permissions: bigint;
    public position: number;

    constructor(client: BloumeChat, data: any) {
        super(client);
        this.id = data.publicId || data.id;
        this.name = data.name;
        this.color = data.color || null;
        this.hoist = data.hoist ?? data.hoise ?? false;
        this.serverId = data.serverPublicId || data.serverId;
        this.position = typeof data.position === "number" ? data.position : 0;

        // Parse permissions into a safe BigInt safely resolving DB structures
        if (typeof data.permissions === "string" || typeof data.permissions === "number" || typeof data.permissions === "bigint") {
            this.permissions = BigInt(data.permissions);
        } else {
            this.permissions = 0n;
        }
    }

    /**
     * Checks if the role has a specific permission.
     */
    hasPermission(permission: bigint): boolean {
        if ((this.permissions & PermissionFlags.ADMINISTRATOR) === PermissionFlags.ADMINISTRATOR) return true;
        return (this.permissions & permission) === permission;
    }

    /**
     * Edits the role.
     */
    async edit(data: { name?: string; color?: string | null; hoist?: boolean; permissions?: bigint | string }) {
        const payload: any = { ...data };
        if (data.permissions !== undefined) payload.permissions = data.permissions.toString();

        await this.client.apiCall(`/servers/${this.serverId}/roles/${this.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });

        if (data.name !== undefined) this.name = data.name;
        if (data.color !== undefined) this.color = data.color;
        if (data.hoist !== undefined) this.hoist = data.hoist;
        if (data.permissions !== undefined) this.permissions = BigInt(data.permissions);
    }

    /**
     * Deletes the role.
     */
    async delete() {
        await this.client.apiCall(`/servers/${this.serverId}/roles/${this.id}`, {
            method: "DELETE",
        });
    }
}
