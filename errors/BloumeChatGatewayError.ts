import { BloumeChatError } from "./BloumeChatError";

/**
 * Thrown when a Socket.IO gateway action (kick/ban/unban, etc.) fails —
 * either the server acked with `{ error }` or no ack arrived before the
 * timeout (`code` is then `"TIMEOUT"`).
 *
 * `code` is the raw value the server sent back. For an ack error this is a
 * dotted i18n key from the webapp's own locale files (e.g.
 * `"servers.errors.cannot_kick_owner"`), not human-readable text — this
 * gateway channel is shared with the browser UI, which resolves that key
 * itself. Bots that want a friendly message have to map these keys on their
 * own (a small, fairly stable set — see `server-nest/src/gateway/servers/server-moderation.service.ts`).
 */
export class BloumeChatGatewayError extends BloumeChatError {
    /** The Socket.IO event that was emitted (e.g. `"server:kick"`). */
    public readonly event: string;
    /** The raw error code/key from the server, or `"TIMEOUT"`. */
    public readonly code: string;

    constructor(event: string, code: string) {
        super(`Gateway action "${event}" failed: ${code}`);
        this.event = event;
        this.code = code;
    }
}
