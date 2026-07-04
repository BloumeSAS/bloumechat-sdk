import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RestManager } from "../rest/RestManager";
import { BloumeChatAPIError } from "../errors/BloumeChatAPIError";
import { BloumeChatTimeoutError } from "../errors/BloumeChatTimeoutError";
import { RateLimitError } from "../errors/RateLimitError";

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
    return {
        ok: (init.status ?? 200) < 400,
        status: init.status ?? 200,
        headers: { get: (key: string) => init.headers?.[key] ?? null },
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as unknown as Response;
}

describe("RestManager", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it("returns parsed JSON on a successful request, and sends the auth/User-Agent headers", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
        const rest = new RestManager("https://bloumechat.com/api/v2", () => "my-token");

        const result = await rest.request("/ping");

        expect(result).toEqual({ ok: true });
        expect(fetchMock).toHaveBeenCalledWith(
            "https://bloumechat.com/api/v2/ping",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer my-token",
                    "X-Bloume-SDK": "true",
                }),
            })
        );
    });

    it("returns null on a 204 No Content", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(null, { status: 204 }));
        const rest = new RestManager("https://bloumechat.com/api/v2", () => "t");

        await expect(rest.request("/thing", { method: "DELETE" })).resolves.toBeNull();
    });

    it("throws BloumeChatAPIError immediately on a non-retryable status (404), without retrying", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ error: "not found" }, { status: 404 }));
        const rest = new RestManager("https://bloumechat.com/api/v2", () => "t");

        await expect(rest.request("/missing")).rejects.toBeInstanceOf(BloumeChatAPIError);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("throws RateLimitError (not a generic BloumeChatAPIError check) on a 429 that exhausts retries, carrying retryAfterMs", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ error: "slow down" }, { status: 429, headers: { "Retry-After": "0" } }));
        const rest = new RestManager("https://bloumechat.com/api/v2", () => "t");

        const err = await rest.request("/spammy", { maxRetries: 1 }).catch(e => e);
        expect(err).toBeInstanceOf(RateLimitError);
        expect(err.status).toBe(429);
        expect(err.retryAfterMs).toBe(0);
        // 1 initial attempt + 1 retry = 2 calls
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("retries a retryable status (503) and succeeds on the second attempt", async () => {
        vi.useFakeTimers();
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ error: "unavailable" }, { status: 503 }))
            .mockResolvedValueOnce(jsonResponse({ ok: true }));

        const rest = new RestManager("https://bloumechat.com/api/v2", () => "t");
        const promise = rest.request("/flaky", { maxRetries: 2 });

        await vi.runAllTimersAsync();
        await expect(promise).resolves.toEqual({ ok: true });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("retries a network TypeError and eventually succeeds", async () => {
        vi.useFakeTimers();
        fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(jsonResponse({ ok: true }));

        const rest = new RestManager("https://bloumechat.com/api/v2", () => "t");
        const promise = rest.request("/network-blip", { maxRetries: 1 });

        await vi.runAllTimersAsync();
        await expect(promise).resolves.toEqual({ ok: true });
    });

    it("throws BloumeChatTimeoutError on an aborted request with no retries left", async () => {
        fetchMock.mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }));
        const rest = new RestManager("https://bloumechat.com/api/v2", () => "t");

        await expect(rest.request("/slow", { maxRetries: 0, timeoutMs: 5000 })).rejects.toBeInstanceOf(BloumeChatTimeoutError);
    });

    it("queues requests beyond the concurrency limit instead of firing them all at once", async () => {
        let inFlight = 0;
        let maxInFlight = 0;
        fetchMock.mockImplementation(async () => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise(r => setTimeout(r, 10));
            inFlight--;
            return jsonResponse({ ok: true });
        });

        const rest = new RestManager("https://bloumechat.com/api/v2", () => "t");
        await Promise.all(Array.from({ length: 10 }, (_, i) => rest.request(`/item/${i}`)));

        expect(maxInFlight).toBeLessThanOrEqual(5);
    });

    describe("per-route rate-limit buckets", () => {
        it("a 429 on one resource does not delay a request to an unrelated resource", async () => {
            vi.useFakeTimers();
            fetchMock.mockImplementation(async (url: string) => {
                if (url.includes("/chat/channelA/")) {
                    return jsonResponse({ error: "slow down" }, { status: 429, headers: { "Retry-After": "5" } });
                }
                return jsonResponse({ ok: true });
            });

            const rest = new RestManager("https://bloumechat.com/api/v2", () => "t");

            // Route A gets rate-limited and exhausts its retries (still fake-timers, resolves once we flush).
            const routeAPromise = rest.request("/chat/channelA/messages", { maxRetries: 0 }).catch(e => e);

            // Route B (different bucket: different second path segment) must resolve immediately,
            // without waiting on route A's 5s backoff.
            const routeBPromise = rest.request("/chat/channelB/messages", { maxRetries: 0 });

            await vi.advanceTimersByTimeAsync(0);
            await expect(routeBPromise).resolves.toEqual({ ok: true });

            await vi.runAllTimersAsync();
            const errA = await routeAPromise;
            expect(errA).toBeInstanceOf(RateLimitError);
        });

        it("a second request to the same rate-limited bucket waits out the backoff before firing", async () => {
            vi.useFakeTimers();
            fetchMock
                .mockResolvedValueOnce(jsonResponse({ error: "slow down" }, { status: 429, headers: { "Retry-After": "2" } }))
                .mockResolvedValueOnce(jsonResponse({ ok: true }));

            const rest = new RestManager("https://bloumechat.com/api/v2", () => "t");

            // First call: gets 429, exhausts its own retries (maxRetries: 0), but still records
            // the bucket's backoff for whoever calls next.
            await rest.request("/servers/s1/roles", { maxRetries: 0 }).catch(() => {});
            expect(fetchMock).toHaveBeenCalledTimes(1);

            // Second call to the SAME bucket should wait for the recorded backoff before firing.
            const second = rest.request("/servers/s1/roles");
            await vi.advanceTimersByTimeAsync(1999);
            expect(fetchMock).toHaveBeenCalledTimes(1); // still waiting

            await vi.advanceTimersByTimeAsync(1);
            await expect(second).resolves.toEqual({ ok: true });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });
    });
});
