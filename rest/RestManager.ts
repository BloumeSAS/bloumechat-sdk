import { BloumeChatAPIError } from "../errors/BloumeChatAPIError";
import { BloumeChatTimeoutError } from "../errors/BloumeChatTimeoutError";
import { RateLimitError } from "../errors/RateLimitError";

/** Options controlling REST request behavior (timeout, retries, rate limiting). */
export interface ApiCallOptions extends RequestInit {
    headers?: Record<string, string>;
    /** Max time (ms) to wait for a response before aborting. Default 15000. */
    timeoutMs?: number;
    /** Max retry attempts on network failure / 429 / 502 / 503 / 504. Default 3. */
    maxRetries?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Groups a request into a rate-limit bucket keyed by method + resource type +
 * "major" ID (the first path segment after the resource type — e.g. the
 * server/channel ID), mirroring how Discord-style APIs scope rate limits per
 * resource rather than per exact endpoint. This keeps the bucket space bounded
 * (one entry per server/channel a bot actually talks to, not one per message/
 * emoji/etc. ID that happens to appear deeper in the path) while still letting
 * `POST /chat/:channelA/...` and `POST /chat/:channelB/...` back off independently.
 */
function bucketKeyFor(method: string, path: string): string {
    const segments = path.split("?")[0].split("/").filter(Boolean);
    return `${method}:${segments.slice(0, 2).join("/")}`;
}

/**
 * Owns all outbound REST traffic: authentication headers, timeouts, retry
 * with exponential backoff (honoring `Retry-After`), a small client-side
 * concurrency limiter so a runaway bot loop throttles itself instead of
 * hammering the API, and per-route rate-limit buckets so a 429 on one
 * resource (e.g. a busy channel) doesn't slow down requests to unrelated
 * resources (e.g. an unrelated server's role list).
 */
export class RestManager {
    private static readonly MAX_CONCURRENT_REQUESTS = 5;
    private _activeRequests = 0;
    private _requestQueue: Array<() => void> = [];

    /** bucketKey -> epoch ms until which requests in that bucket must wait. */
    private _buckets = new Map<string, number>();

    constructor(
        private readonly baseUrl: string,
        private readonly getToken: () => string | null
    ) {}

    private async _acquireSlot(): Promise<void> {
        if (this._activeRequests < RestManager.MAX_CONCURRENT_REQUESTS) {
            this._activeRequests++;
            return;
        }
        return new Promise(resolve => {
            this._requestQueue.push(() => {
                this._activeRequests++;
                resolve();
            });
        });
    }

    private _releaseSlot(): void {
        this._activeRequests--;
        const next = this._requestQueue.shift();
        if (next) next();
    }

    /** Waits out any active rate-limit backoff for this bucket, then prunes expired entries. */
    private async _awaitBucket(bucketKey: string): Promise<void> {
        const blockedUntil = this._buckets.get(bucketKey);
        if (blockedUntil && blockedUntil > Date.now()) {
            await sleep(blockedUntil - Date.now());
        }
        for (const [key, until] of this._buckets) {
            if (until <= Date.now()) this._buckets.delete(key);
        }
    }

    /**
     * Makes a raw authenticated call to the BloumeChat REST API.
     *
     * Requests are queued behind a small concurrency limit, time out after
     * `timeoutMs` (default 15s), and automatically retry with exponential
     * backoff on network errors or 429/502/503/504 responses (respecting a
     * `Retry-After` header when present). A 429 also blocks further requests
     * to the same rate-limit bucket (see {@link bucketKeyFor}) until the
     * backoff elapses — unrelated buckets are unaffected.
     */
    public async request(path: string, options: ApiCallOptions = {}): Promise<any> {
        const { timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES, ...init } = options;
        const method = (init.method || "GET").toUpperCase();
        const bucketKey = bucketKeyFor(method, path);

        await this._acquireSlot();
        try {
            let attempt = 0;
            while (true) {
                await this._awaitBucket(bucketKey);

                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), timeoutMs);

                try {
                    const res = await fetch(`${this.baseUrl}${path}`, {
                        ...init,
                        signal: controller.signal,
                        headers: {
                            Authorization: `Bearer ${this.getToken()}`,
                            "Content-Type": "application/json",
                            "X-Bloume-SDK": "true",
                            "User-Agent": "BloumeChat-SDK",
                            ...init.headers,
                        },
                    });

                    if (!res.ok) {
                        const retryAfterHeader = res.headers.get("Retry-After");
                        const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : NaN;

                        if (res.status === 429) {
                            const backoffMs = Math.min(Number.isFinite(retryAfterMs) ? retryAfterMs : 2 ** attempt * 500, 30_000);
                            this._buckets.set(bucketKey, Date.now() + backoffMs);
                        }

                        if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
                            if (res.status !== 429) {
                                const backoffMs = Number.isFinite(retryAfterMs) ? retryAfterMs : 2 ** attempt * 500;
                                await sleep(Math.min(backoffMs, 30_000));
                            }
                            attempt++;
                            continue;
                        }

                        const body = await res.text();
                        if (res.status === 429) {
                            throw new RateLimitError(path, body, Number.isFinite(retryAfterMs) ? retryAfterMs : null);
                        }
                        throw new BloumeChatAPIError(res.status, path, body);
                    }

                    if (res.status === 204) return null;
                    return await res.json();
                } catch (err: any) {
                    if (err instanceof BloumeChatAPIError) throw err;

                    const isAbort = err?.name === "AbortError";
                    const isNetworkError = isAbort || err?.name === "TypeError";
                    if (isNetworkError && attempt < maxRetries) {
                        await sleep(Math.min(2 ** attempt * 500, 30_000));
                        attempt++;
                        continue;
                    }
                    if (isAbort) throw new BloumeChatTimeoutError(path, timeoutMs);
                    throw err;
                } finally {
                    clearTimeout(timeout);
                }
            }
        } finally {
            this._releaseSlot();
        }
    }
}
