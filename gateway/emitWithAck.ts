import type { Socket } from "socket.io-client";
import { BloumeChatGatewayError } from "../errors/BloumeChatGatewayError";

interface AckResult {
    error?: string;
    [key: string]: unknown;
}

/**
 * Emits a Socket.IO event and turns the server's ack into a Promise.
 *
 * server-nest's moderation `@SubscribeMessage` handlers (`server:kick`,
 * `server:ban`, `server:unban`, …) ack with `{ error?: string }` — a present
 * `error` rejects with {@link BloumeChatGatewayError}. No ack within
 * `timeoutMs` also rejects (as `"TIMEOUT"`) instead of hanging forever.
 */
export function emitWithAck<T extends AckResult = AckResult>(socket: Socket, event: string, data: unknown, timeoutMs = 10_000): Promise<T> {
    return new Promise((resolve, reject) => {
        let settled = false;

        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new BloumeChatGatewayError(event, "TIMEOUT"));
        }, timeoutMs);

        socket.emit(event, data, (ack: T) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (ack && ack.error) {
                reject(new BloumeChatGatewayError(event, ack.error));
            } else {
                resolve(ack);
            }
        });
    });
}
