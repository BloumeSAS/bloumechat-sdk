import { describe, expect, it } from "vitest";
import { Channel } from "../structures/Channel";
import { BloumeChatVoiceError } from "../errors/BloumeChatVoiceError";
import { addUint32, nextUint16 } from "../voice/util";
import type { BloumeChat } from "../bloumechat";

describe("voice/util", () => {
    it("nextUint16 wraps around at 65536", () => {
        expect(nextUint16(0)).toBe(1);
        expect(nextUint16(65535)).toBe(0);
    });

    it("addUint32 wraps around at 2^32", () => {
        expect(addUint32(0, 960)).toBe(960);
        expect(addUint32(0xffffffff, 1)).toBe(0);
    });
});

describe("Channel.join / leave", () => {
    function makeChannel(type: string) {
        const client = { voice: { join: () => Promise.resolve(), connection: null, leave: () => {} } } as unknown as BloumeChat;
        return new Channel(client, { publicId: "chan_1", name: "general", type, serverPublicId: "server_1" });
    }

    it("join() throws on a non-voice channel", async () => {
        const channel = makeChannel("TEXT");
        await expect(channel.join()).rejects.toBeInstanceOf(BloumeChatVoiceError);
    });

    it("leave() is a no-op on a non-voice channel", () => {
        const channel = makeChannel("TEXT");
        expect(() => channel.leave()).not.toThrow();
    });
});
