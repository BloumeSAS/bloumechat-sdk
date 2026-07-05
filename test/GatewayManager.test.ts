import { describe, expect, it, vi } from "vitest";
import { GatewayManager } from "../gateway/GatewayManager";
import { Collection } from "../util/Collection";
import { Guild } from "../structures/Guild";
import { Member } from "../structures/Member";
import { User } from "../structures/User";
import type { BloumeChat } from "../bloumechat";

function makeFakeSocket() {
    const handlers = new Map<string, (data: any) => void>();
    return {
        on: vi.fn((event: string, handler: (data: any) => void) => handlers.set(event, handler)),
        emit(event: string, data: any) {
            handlers.get(event)?.(data);
        },
    };
}

function makeFakeClient(apiResponse: any = {}) {
    const emitted: Array<[string, any]> = [];
    const client = {
        guilds: { cache: new Collection<string, Guild>() },
        members: { cache: new Collection<string, Member>() },
        users: { cache: new Collection<string, User>() },
        apiCall: vi.fn().mockResolvedValue(apiResponse),
        emit: vi.fn((event: string, data: any) => emitted.push([event, data])),
    } as unknown as BloumeChat;
    (client.members as any).fetch = async (serverId: string, memberId: string) => {
        const data = await client.apiCall(`/servers/${serverId}/members/${memberId}`);
        const member = new Member(client, data);
        client.members.cache.set(member.id, member);
        return member;
    };
    return { client, emitted };
}

describe("GatewayManager", () => {
    it("emits guildCreate and caches the guild on server:joined", () => {
        const { client, emitted } = makeFakeClient();
        const socket = makeFakeSocket();
        new GatewayManager(client).attach(socket as any);

        socket.emit("server:joined", { publicId: "server_1", name: "My Server", memberCount: 3 });

        expect(client.guilds.cache.get("server_1")).toBeInstanceOf(Guild);
        expect(emitted).toContainEqual(["guildCreate", client.guilds.cache.get("server_1")]);
    });

    it("adds the member to client.members.cache on server:member_add", () => {
        const { client } = makeFakeClient();
        const socket = makeFakeSocket();
        new GatewayManager(client).attach(socket as any);

        socket.emit("server:member_add", {
            serverPublicId: "server_1",
            member: { publicId: "user_1", name: "Bot", tag: "0001", isBot: true },
        });

        const cached = [...client.members.cache.values()][0];
        expect(cached).toBeInstanceOf(Member);
        expect(cached!.user.id).toBe("user_1");
        expect(cached!.serverId).toBe("server_1");
    });

    it("removes the matching member from cache on server:member_removed (kick/ban) by user publicId", () => {
        const { client, emitted } = makeFakeClient();
        const socket = makeFakeSocket();
        new GatewayManager(client).attach(socket as any);

        socket.emit("server:member_add", {
            serverPublicId: "server_1",
            member: { publicId: "user_1", name: "Bot", tag: "0001" },
        });
        expect(client.members.cache.size).toBe(1);

        socket.emit("server:member_removed", { serverPublicId: "server_1", memberPublicId: "user_1", reason: "banned" });

        expect(client.members.cache.size).toBe(0);
        expect(emitted.some(([event]) => event === "guildBanAdd")).toBe(true);
        expect(emitted.some(([event, data]) => event === "guildMemberRemove" && data instanceof Member)).toBe(true);
    });

    it("patches the cached guild's name/icon on server:updated instead of leaving it stale", () => {
        const { client } = makeFakeClient();
        const socket = makeFakeSocket();
        new GatewayManager(client).attach(socket as any);
        const guild = new Guild(client, { publicId: "server_1", name: "Old Name" });
        client.guilds.cache.set(guild.id, guild);

        socket.emit("server:updated", { serverPublicId: "server_1", name: "New Name", imageUrl: "new.png" });

        expect(guild.name).toBe("New Name");
        expect(guild.icon).toBe("new.png");
    });

    it("removes the guild from cache on server:deleted / server:you_removed / server:you_left", () => {
        const { client } = makeFakeClient();
        const socket = makeFakeSocket();
        new GatewayManager(client).attach(socket as any);
        client.guilds.cache.set("server_1", new Guild(client, { publicId: "server_1", name: "S1" }));
        client.guilds.cache.set("server_2", new Guild(client, { publicId: "server_2", name: "S2" }));
        client.guilds.cache.set("server_3", new Guild(client, { publicId: "server_3", name: "S3" }));

        socket.emit("server:deleted", { serverPublicId: "server_1" });
        socket.emit("server:you_removed", { serverPublicId: "server_2" });
        socket.emit("server:you_left", { serverPublicId: "server_3" });

        expect(client.guilds.cache.size).toBe(0);
    });

    it("refetches and re-caches the member on server:member_update", async () => {
        const { client, emitted } = makeFakeClient({ publicId: "user_1", name: "Bot", tag: "0001", roles: ["role_new"] });
        const socket = makeFakeSocket();
        new GatewayManager(client).attach(socket as any);

        socket.emit("server:member_update", { serverPublicId: "server_1", memberPublicId: "user_1" });
        await new Promise(resolve => setTimeout(resolve, 0));

        const cached = client.members.cache.get("user_1");
        expect(cached?.roles).toEqual(["role_new"]);
        expect(emitted.some(([event, data]) => event === "guildMemberUpdate" && data === cached)).toBe(true);
    });

    it("patches the cached user's username on user:update and status on presence:update", () => {
        const { client } = makeFakeClient();
        const socket = makeFakeSocket();
        new GatewayManager(client).attach(socket as any);
        const user = new User(client, { publicId: "user_1", name: "Old", tag: "0001" });
        client.users.cache.set(user.id, user);

        socket.emit("user:update", { userPublicId: "user_1", name: "New" });
        expect(user.username).toBe("New");

        socket.emit("presence:update", { userPublicId: "user_1", status: "idle" });
        expect(user.status).toBe("idle");
    });
});
