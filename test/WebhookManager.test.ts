import { describe, expect, it, vi } from "vitest";
import { WebhookManager } from "../managers/WebhookManager";
import { Webhook } from "../structures/Webhook";
import type { Channel } from "../structures/Channel";

function makeFakeChannel(apiResponse: any): Channel {
    return {
        id: "chan_1",
        client: { apiCall: vi.fn().mockResolvedValue(apiResponse) },
    } as unknown as Channel;
}

describe("WebhookManager", () => {
    it("fetchAll() wraps raw payloads into Webhook instances and populates the cache", async () => {
        const channel = makeFakeChannel({ webhooks: [{ publicId: "wh_1", name: "Logger" }] });
        const manager = new WebhookManager(channel);

        const webhooks = await manager.fetchAll();

        expect(webhooks).toHaveLength(1);
        expect(webhooks[0]).toBeInstanceOf(Webhook);
        expect(webhooks[0]!.name).toBe("Logger");
        expect(manager.cache.get("wh_1")).toBe(webhooks[0]);
    });

    it("create() posts the payload and caches the resulting Webhook", async () => {
        const channel = makeFakeChannel({ webhook: { publicId: "wh_2", name: "Alerts" } });
        const manager = new WebhookManager(channel);

        const webhook = await manager.create({ name: "Alerts" });

        expect(channel.client.apiCall).toHaveBeenCalledWith("/channels/chan_1/webhooks", expect.objectContaining({ method: "POST" }));
        expect(webhook).toBeInstanceOf(Webhook);
        expect(webhook.channelId).toBe("chan_1");
        expect(manager.cache.get("wh_2")).toBe(webhook);
    });

    it("delete() calls the DELETE endpoint and evicts the cache entry", async () => {
        const channel = makeFakeChannel({});
        const manager = new WebhookManager(channel);
        manager.cache.set("wh_1", new Webhook(channel.client, { publicId: "wh_1", name: "Logger" }));

        await manager.delete("wh_1");

        expect(channel.client.apiCall).toHaveBeenCalledWith("/channels/chan_1/webhooks/wh_1", { method: "DELETE" });
        expect(manager.cache.has("wh_1")).toBe(false);
    });
});
