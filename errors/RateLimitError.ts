import { BloumeChatAPIError } from "./BloumeChatAPIError";

/**
 * Thrown when a request keeps getting rate-limited (HTTP 429) past the
 * configured `maxRetries` — as opposed to the common case, which the SDK
 * retries transparently and the caller never sees.
 */
export class RateLimitError extends BloumeChatAPIError {
    /** How long (ms) the API asked the caller to wait, if it sent a Retry-After header. */
    public readonly retryAfterMs: number | null;

    constructor(path: string, body: string, retryAfterMs: number | null) {
        super(429, path, body);
        this.retryAfterMs = retryAfterMs;
    }
}
