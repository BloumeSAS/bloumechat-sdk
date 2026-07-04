import { BloumeChatError } from "./BloumeChatError";

/** A non-2xx response from the BloumeChat REST API that wasn't retried away. */
export class BloumeChatAPIError extends BloumeChatError {
    /** HTTP status code returned by the API. */
    public readonly status: number;
    /** The API path that was called (e.g. "/channels/dm/123"). */
    public readonly path: string;
    /** Raw response body (truncated), for debugging. */
    public readonly body: string;

    constructor(status: number, path: string, body: string) {
        super(`API Error ${status} on ${path}: ${body.slice(0, 500)}`);
        this.status = status;
        this.path = path;
        this.body = body;
    }
}
