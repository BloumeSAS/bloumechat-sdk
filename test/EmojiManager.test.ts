import { describe, expect, it, vi } from "vitest";
import { EmojiManager } from "../managers/EmojiManager";
import { Emoji } from "../structures/Emoji";
import type { Guild } from "../structures/Guild";

function makeFakeGuild(apiResponse: any): Guild {
    return {
        id: "server_1",
        client: { apiCall: vi.fn().mockResolvedValue(apiResponse) },
    } as unknown as Guild;
}

describe("EmojiManager", () => {
    it("fetchAll() wraps raw payloads into Emoji instances and populates the cache", async () => {
        const guild = makeFakeGuild({ emojis: [{ publicId: "emoji_1", name: "pepe", imageUrl: "https://x/e.png" }] });
        const manager = new EmojiManager(guild);

        const emojis = await manager.fetchAll();

        expect(emojis).toHaveLength(1);
        expect(emojis[0]).toBeInstanceOf(Emoji);
        expect(emojis[0]!.name).toBe("pepe");
        expect(manager.cache.get("emoji_1")).toBe(emojis[0]);
    });

    it("fetchAll() clears stale cache entries on refresh", async () => {
        const guild = makeFakeGuild({ emojis: [] });
        const manager = new EmojiManager(guild);
        manager.cache.set("stale", new Emoji(guild.client, { publicId: "stale", name: "old" }));

        await manager.fetchAll();

        expect(manager.cache.size).toBe(0);
    });

    it("create() posts the payload and caches the resulting Emoji", async () => {
        const guild = makeFakeGuild({ emoji: { publicId: "emoji_2", name: "new_emoji", imageUrl: "https://x/n.png" } });
        const manager = new EmojiManager(guild);

        const emoji = await manager.create({ name: "new_emoji", imageUrl: "https://x/n.png" });

        expect(guild.client.apiCall).toHaveBeenCalledWith("/servers/server_1/emojis", expect.objectContaining({ method: "POST" }));
        expect(emoji).toBeInstanceOf(Emoji);
        expect(manager.cache.get("emoji_2")).toBe(emoji);
    });

    it("delete() calls the DELETE endpoint and evicts the cache entry", async () => {
        const guild = makeFakeGuild({});
        const manager = new EmojiManager(guild);
        manager.cache.set("emoji_1", new Emoji(guild.client, { publicId: "emoji_1", name: "pepe" }));

        await manager.delete("emoji_1");

        expect(guild.client.apiCall).toHaveBeenCalledWith("/servers/server_1/emojis/emoji_1", { method: "DELETE" });
        expect(manager.cache.has("emoji_1")).toBe(false);
    });
});
