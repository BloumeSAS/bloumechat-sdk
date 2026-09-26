import { describe, expect, it, vi } from "vitest";
import { Member } from "../structures/Member";
import { Guild } from "../structures/Guild";
import { User } from "../structures/User";
import { BloumeChatAuthError } from "../errors/BloumeChatAuthError";
import { BloumeChatGatewayError } from "../errors/BloumeChatGatewayError";
import { Collection } from "../util/Collection";
import type { BloumeChat } from "../bloumechat";

function makeFakeSocket(ack: any = {}) {
    return {
        emit: vi.fn((_event: string, _data: any, cb?: (ack: any) => void) => cb?.(ack)),
    };
}

function makeFakeClient(socket: any = null, apiResponse: any = {}) {
    const guilds = new Collection<string, Guild>();
    const client = {
        guilds: { cache: guilds },
        users: { cache: new Collection<string, User>() },
        getSocket: () => socket,
        apiCall: vi.fn().mockResolvedValue(apiResponse),
        sendMessage: vi.fn().mockResolvedValue({ id: "msg_1" }),
    } as unknown as BloumeChat;
    return { client, guilds };
}

function makeMember(client: BloumeChat, overrides: any = {}) {
    return new Member(client, {
        publicId: "member_1",
        userId: "user_1",
        user: { publicId: "user_1", name: "Alice", tag: "0001" },
        serverPublicId: "server_1",
        roles: [],
        joinedAt: new Date().toISOString(),
        ...overrides,
    });
}

describe("Member#edit", () => {
    it("PATCHes the user's public ID in the URL, not the membership's own ID", async () => {
        const { client } = makeFakeClient();
        const member = makeMember(client);

        await member.edit({ nickname: "Ali" });

        expect(client.apiCall).toHaveBeenCalledWith("/servers/server_1/members/user_1", expect.objectContaining({ method: "PATCH" }));
    });
});

describe("Member#kick / #ban", () => {
    it("kick() emits server:kick with serverPublicId + the user's public ID and resolves on a clean ack", async () => {
        const socket = makeFakeSocket({});
        const { client } = makeFakeClient(socket);
        const member = makeMember(client);

        await expect(member.kick()).resolves.toBeUndefined();
        expect(socket.emit).toHaveBeenCalledWith(
            "server:kick",
            { serverPublicId: "server_1", userPublicId: "user_1" },
            expect.any(Function)
        );
    });

    it("ban() sends reason/deleteHistory and rejects with BloumeChatGatewayError on a server error ack", async () => {
        const socket = makeFakeSocket({ error: "servers.errors.cannot_ban_owner" });
        const { client } = makeFakeClient(socket);
        const member = makeMember(client);

        await expect(member.ban({ reason: "spam", deleteHistory: "7d" })).rejects.toThrow(BloumeChatGatewayError);
        expect(socket.emit).toHaveBeenCalledWith(
            "server:ban",
            { serverPublicId: "server_1", userPublicId: "user_1", reason: "spam", deleteHistory: "7d" },
            expect.any(Function)
        );
    });

    it("kick()/ban() throw BloumeChatAuthError when there is no active connection", async () => {
        const { client } = makeFakeClient(null);
        const member = makeMember(client);

        await expect(member.kick()).rejects.toThrow(BloumeChatAuthError);
        await expect(member.ban()).rejects.toThrow(BloumeChatAuthError);
    });
});

describe("Member#hasRole / #isOwner", () => {
    it("hasRole matches by role ID directly", () => {
        const { client } = makeFakeClient();
        const member = makeMember(client, { roles: [{ id: "role_1", publicId: "role_1" }] });

        expect(member.hasRole("role_1")).toBe(true);
        expect(member.hasRole("role_2")).toBe(false);
    });

    it("hasRole falls back to a case-insensitive name match via the guild's role cache", () => {
        const { client, guilds } = makeFakeClient();
        const guild = new Guild(client, { publicId: "server_1", name: "S1" });
        guild.roles.cache.set("role_1", { id: "role_1", name: "Moderator" } as any);
        guilds.set("server_1", guild);
        const member = makeMember(client, { roles: [{ id: "role_1", publicId: "role_1" }] });

        expect(member.hasRole("moderator")).toBe(true);
        expect(member.hasRole("admin")).toBe(false);
    });

    it("isOwner compares against the cached guild's ownerId", () => {
        const { client, guilds } = makeFakeClient();
        const guild = new Guild(client, { publicId: "server_1", name: "S1", ownerId: "user_1" });
        guilds.set("server_1", guild);
        const member = makeMember(client);

        expect(member.isOwner).toBe(true);
    });
});

describe("Member#send", () => {
    it("opens a DM with the member's user and routes through client.sendMessage", async () => {
        const { client } = makeFakeClient(null, { publicId: "dm_1", recipient: { publicId: "user_1", name: "Alice" } });
        (client as any).createDM = async (userId: string) => {
            const data = await client.apiCall(`/channels/dm/${userId}`);
            return { id: data.publicId };
        };
        const member = makeMember(client);

        await member.send("hey");

        expect(client.apiCall).toHaveBeenCalledWith("/channels/dm/user_1");
        expect(client.sendMessage).toHaveBeenCalledWith("dm_1", "hey");
    });
});
