import { BloumeChatError } from "./BloumeChatError";

/** Thrown when a REST request is aborted for exceeding `timeoutMs` (default 15s). */
export class BloumeChatTimeoutError extends BloumeChatError {
    public readonly path: string;
    public readonly timeoutMs: number;

    constructor(path: string, timeoutMs: number) {
        super(`API request timed out after ${timeoutMs}ms: ${path}`);
        this.path = path;
        this.timeoutMs = timeoutMs;
    }
}
