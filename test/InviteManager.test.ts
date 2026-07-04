import { describe, expect, it, vi } from "vitest";
import { InviteManager } from "../managers/InviteManager";
import type { Guild } from "../structures/Guild";

function makeFakeGuild(apiResponse: any): Guild {
    return {
        id: "server_1",
        client: { apiCall: vi.fn().mockResolvedValue(apiResponse) },
    } as unknown as Guild;
}

describe("InviteManager", () => {
    it("fetchAll() requests the server-wide list (?all=true) and caches by code", async () => {
        const invite = { code: "abc123", expiresAt: null };
        const guild = makeFakeGuild({ invites: [invite] });
        const manager = new InviteManager(guild);

        const invites = await manager.fetchAll();

        expect(guild.client.apiCall).toHaveBeenCalledWith(expect.stringContaining("?all=true"));
        expect(invites).toEqual([invite]);
        expect(manager.cache.get("abc123")).toEqual(invite);
    });

    it("fetchAll() defaults to an empty array and clears the cache when the API omits invites", async () => {
        const guild = makeFakeGuild({});
        const manager = new InviteManager(guild);
        manager.cache.set("stale", { code: "stale", expiresAt: null });

        const invites = await manager.fetchAll();

        expect(invites).toEqual([]);
        expect(manager.cache.size).toBe(0);
    });

    it("create() posts to the server invites endpoint and caches the result", async () => {
        const invite = { code: "new1234", expiresAt: null };
        const guild = makeFakeGuild({ invite });
        const manager = new InviteManager(guild);

        const created = await manager.create("chan_1", { maxUses: 5 });

        expect(guild.client.apiCall).toHaveBeenCalledWith("/servers/server_1/invites", expect.objectContaining({ method: "POST" }));
        expect(created).toEqual(invite);
        expect(manager.cache.get("new1234")).toEqual(invite);
    });

    it("delete() calls DELETE /invites/:code (not nested under /servers) and evicts the cache", async () => {
        const guild = makeFakeGuild({});
        const manager = new InviteManager(guild);
        manager.cache.set("abc123", { code: "abc123", expiresAt: null });

        await manager.delete("abc123");

        expect(guild.client.apiCall).toHaveBeenCalledWith("/invites/abc123", { method: "DELETE" });
        expect(manager.cache.has("abc123")).toBe(false);
    });
});
