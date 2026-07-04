import { describe, expect, it, vi } from "vitest";
import { Role } from "../structures/Role";
import { PermissionFlags } from "../util/Permissions";
import type { BloumeChat } from "../bloumechat";

function makeFakeClient(): BloumeChat {
    return { apiCall: vi.fn().mockResolvedValue({}) } as unknown as BloumeChat;
}

function makeRole(overrides: Partial<{ permissions: string | number | bigint }> = {}) {
    const client = makeFakeClient();
    const role = new Role(client, {
        publicId: "role_1",
        name: "Moderator",
        serverPublicId: "server_1",
        permissions: overrides.permissions ?? PermissionFlags.SEND_MESSAGES.toString(),
    });
    return { role, client };
}

describe("Role", () => {
    it("parses string permission bitmasks into BigInt", () => {
        const { role } = makeRole({ permissions: PermissionFlags.SEND_MESSAGES.toString() });
        expect(role.permissions).toBe(PermissionFlags.SEND_MESSAGES);
    });

    it("defaults to 0n when permissions data is missing/invalid", () => {
        const client = makeFakeClient();
        const role = new Role(client, { publicId: "r", name: "Empty", serverPublicId: "s" });
        expect(role.permissions).toBe(0n);
    });

    it("hasPermission() returns true only when the exact flag is present", () => {
        const { role } = makeRole({ permissions: PermissionFlags.SEND_MESSAGES.toString() });
        expect(role.hasPermission(PermissionFlags.SEND_MESSAGES)).toBe(true);
        expect(role.hasPermission(PermissionFlags.BAN_MEMBERS)).toBe(false);
    });

    it("hasPermission() always returns true for ADMINISTRATOR, bypassing individual flags", () => {
        const { role } = makeRole({ permissions: PermissionFlags.ADMINISTRATOR.toString() });
        expect(role.hasPermission(PermissionFlags.BAN_MEMBERS)).toBe(true);
        expect(role.hasPermission(PermissionFlags.MANAGE_SERVER)).toBe(true);
    });

    it("edit() calls the API with a PATCH request and applies the change optimistically", async () => {
        const { role, client } = makeRole();
        await role.edit({ name: "Senior Moderator", color: "#8b0000" });

        expect(client.apiCall).toHaveBeenCalledWith(
            "/servers/server_1/roles/role_1",
            expect.objectContaining({ method: "PATCH" })
        );
        expect(role.name).toBe("Senior Moderator");
        expect(role.color).toBe("#8b0000");
    });

    it("edit() serializes bigint permissions to a string for the API payload", async () => {
        const { role, client } = makeRole();
        await role.edit({ permissions: PermissionFlags.MANAGE_ROLES });

        const [, options] = (client.apiCall as any).mock.calls[0];
        const body = JSON.parse(options.body);
        expect(body.permissions).toBe(PermissionFlags.MANAGE_ROLES.toString());
        expect(role.permissions).toBe(PermissionFlags.MANAGE_ROLES);
    });

    it("delete() calls the API with a DELETE request", async () => {
        const { role, client } = makeRole();
        await role.delete();

        expect(client.apiCall).toHaveBeenCalledWith(
            "/servers/server_1/roles/role_1",
            expect.objectContaining({ method: "DELETE" })
        );
    });
});
