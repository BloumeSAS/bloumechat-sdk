import { describe, expect, it, vi } from "vitest";
import { Channel } from "../structures/Channel";
import { Message } from "../structures/Message";
import type { BloumeChat } from "../bloumechat";

function makeFakeClient(apiResponse: any): BloumeChat {
    return {
        apiCall: vi.fn().mockResolvedValue(apiResponse),
        users: { cache: { get: () => undefined } },
    } as unknown as BloumeChat;
}

function makeChannel(client: BloumeChat) {
    return new Channel(client, { publicId: "chan_1", name: "general", type: "TEXT", serverPublicId: "server_1" });
}

const RAW_MESSAGE = {
    publicId: "msg_1",
    content: "hi",
    author: { publicId: "user_1", name: "Bot", tag: "0001" },
    channelPublicId: "chan_1",
    createdAt: new Date().toISOString(),
};

describe("Channel", () => {
    it("fetchMessages() wraps raw payloads into Message instances", async () => {
        const client = makeFakeClient({ messages: [RAW_MESSAGE] });
        const channel = makeChannel(client);

        const messages = await channel.fetchMessages();

        expect(messages).toHaveLength(1);
        expect(messages[0]).toBeInstanceOf(Message);
        expect(messages[0].content).toBe("hi");
    });

    it("search() and fetchPins() also wrap results into Message instances", async () => {
        const client = makeFakeClient({ messages: [RAW_MESSAGE], pins: [RAW_MESSAGE] });
        const channel = makeChannel(client);

        const searched = await channel.search("hi");
        expect(searched[0]).toBeInstanceOf(Message);

        const pinned = await channel.fetchPins();
        expect(pinned[0]).toBeInstanceOf(Message);
    });

    it("fetchMessages() returns an empty array when the API omits messages", async () => {
        const client = makeFakeClient({});
        const channel = makeChannel(client);

        await expect(channel.fetchMessages()).resolves.toEqual([]);
    });
});
