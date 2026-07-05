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

function makeFakeClient() {
    const emitted: Array<[string, any]> = [];
    const client = {
        guilds: { cache: new Collection<string, Guild>() },
        members: { cache: new Collection<string, Member>() },
        users: { cache: new Collection<string, User>() },
        emit: vi.fn((event: string, data: any) => emitted.push([event, data])),
    } as unknown as BloumeChat;
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
});
