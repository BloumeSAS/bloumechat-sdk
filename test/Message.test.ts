import { describe, expect, it, vi } from "vitest";
import { Message } from "../structures/Message";
import type { BloumeChat } from "../bloumechat";

function makeFakeClient(apiResponse: any): BloumeChat {
    return {
        apiCall: vi.fn().mockResolvedValue(apiResponse),
        users: { cache: { get: () => undefined } },
    } as unknown as BloumeChat;
}

function makeMessage(client: BloumeChat) {
    return new Message(client, {
        publicId: "msg_1",
        content: "hi",
        author: { publicId: "user_1", name: "Bot", tag: "0001" },
        channelPublicId: "chan_1",
        createdAt: new Date().toISOString(),
    });
}

describe("Message#fetchReactions", () => {
    it("flattens the matching emoji group into ReactionUserDTO[], not the raw nested payload", async () => {
        const client = makeFakeClient({
            reactions: [
                {
                    emoji: "🎉",
                    count: 2,
                    users: [
                        { publicId: "u1", name: "Alice", tag: "0001", image: "a.png" },
                        { publicId: "u2", name: "Bob", tag: "0002", image: null },
                    ],
                },
                { emoji: "👍", count: 1, users: [{ publicId: "u3", name: "Carol", tag: "0003", image: null }] },
            ],
        });
        const message = makeMessage(client);

        const users = await message.fetchReactions("🎉");

        expect(users).toEqual([
            { userPublicId: "u1", userName: "Alice", userImage: "a.png" },
            { userPublicId: "u2", userName: "Bob", userImage: null },
        ]);
    });

    it("returns an empty array when no one reacted with that emoji", async () => {
        const client = makeFakeClient({ reactions: [] });
        const message = makeMessage(client);

        await expect(message.fetchReactions("🎉")).resolves.toEqual([]);
    });
});
