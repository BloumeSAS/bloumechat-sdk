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
 * Owns all outbound REST traffic: authentication headers, timeouts, retry
 * with exponential backoff (honoring `Retry-After`), and a small client-side
 * concurrency limiter so a runaway bot loop throttles itself instead of
 * hammering the API and getting hard-banned by the server-side rate limiter.
 */
export class RestManager {
    private static readonly MAX_CONCURRENT_REQUESTS = 5;
    private _activeRequests = 0;
    private _requestQueue: Array<() => void> = [];

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

    /**
     * Makes a raw authenticated call to the BloumeChat REST API.
     *
     * Requests are queued behind a small concurrency limit, time out after
     * `timeoutMs` (default 15s), and automatically retry with exponential
     * backoff on network errors or 429/502/503/504 responses (respecting a
     * `Retry-After` header when present).
     */
    public async request(path: string, options: ApiCallOptions = {}): Promise<any> {
        const { timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES, ...init } = options;

        await this._acquireSlot();
        try {
            let attempt = 0;
            while (true) {
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

                        if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
                            const backoffMs = Number.isFinite(retryAfterMs) ? retryAfterMs : 2 ** attempt * 500;
                            await sleep(Math.min(backoffMs, 30_000));
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
