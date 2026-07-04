import { describe, expect, it } from "vitest";
import { BloumeChat } from "../bloumechat";

describe("BloumeChat client", () => {
    it("starts with no user, no readyAt, and a null uptime", () => {
        const client = new BloumeChat();
        expect(client.user).toBeNull();
        expect(client.readyAt).toBeNull();
        expect(client.uptime).toBeNull();
    });

    it("exposes the official production endpoints by default", () => {
        const client = new BloumeChat();
        expect(client.baseUrl).toBe("https://bloumechat.com/api/v2");
        expect(client.socketUrl).toBe("https://api.bloumechat.com");
    });

    it("login() rejects with a clear error on an empty token, before touching the network", async () => {
        const client = new BloumeChat();
        await expect(client.login("")).rejects.toThrow(/non-empty bot token/i);
    });

    it("login() rejects on a non-string token", async () => {
        const client = new BloumeChat();
        await expect(client.login(undefined as unknown as string)).rejects.toThrow(/non-empty bot token/i);
        await expect(client.login(12345 as unknown as string)).rejects.toThrow(/non-empty bot token/i);
    });

    it("never leaks the raw bot token via console.log()/util.inspect(), and the snapshot is not circular", () => {
        const client = new BloumeChat();
        (client as any)._token = "super-secret-token";

        const inspected = (client as any)[Symbol.for("nodejs.util.inspect.custom")]();
        expect(inspected._token).toBe("[REDACTED]");
        // Must be safely re-serializable — this also guards against manager caches
        // (which hold a back-reference to the client) sneaking a circular structure in.
        expect(() => JSON.stringify(inspected)).not.toThrow();
        expect(JSON.stringify(inspected)).not.toContain("super-secret-token");
    });

    it("never leaks the raw bot token via JSON.stringify()", () => {
        const client = new BloumeChat();
        (client as any)._token = "super-secret-token";

        const serialized = JSON.stringify(client);
        expect(serialized).not.toContain("super-secret-token");
        expect(JSON.parse(serialized)._token).toBe("[REDACTED]");
    });

    it("toJSON()/inspect report a null token before login", () => {
        const client = new BloumeChat();
        expect(client.toJSON()._token).toBeNull();
    });

    it("getSocket() returns null before login() has ever been called", () => {
        const client = new BloumeChat();
        expect(client.getSocket()).toBeNull();
    });
});
