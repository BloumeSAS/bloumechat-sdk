import type { BloumeChat } from "../bloumechat";
import { BloumeChatAuthError } from "../errors/BloumeChatAuthError";
import type { Channel } from "../structures/Channel";
import { VoiceConnection } from "../voice/VoiceConnection";
import type { VoiceJoinOptions } from "../voice/types";

/**
 * Owns the bot's voice connection. A bot's underlying socket session can only
 * be a member of one voice room at a time (the server's `voice:leave` takes
 * no channel argument — it always means "leave whichever room I'm in"), so
 * this tracks at most one {@link VoiceConnection}, not a per-channel map.
 */
export class VoiceManager {
    private current: VoiceConnection | null = null;

    constructor(private readonly client: BloumeChat) {}

    /** The bot's active voice connection, if any. */
    get connection(): VoiceConnection | null {
        return this.current;
    }

    /** Joins a voice channel, leaving any previously-joined one first. Prefer `channel.join()`. */
    async join(channel: Channel, options?: VoiceJoinOptions): Promise<VoiceConnection> {
        const socket = this.client.getSocket();
        if (!socket || !this.client.user) {
            throw new BloumeChatAuthError("Voice channel.join() requires an active connection — call login() first.");
        }

        if (this.current) {
            if (this.current.channelId === channel.id && this.current.state !== "destroyed") return this.current;
            this.leave();
        }

        const connection = new VoiceConnection({
            socket,
            channelId: channel.id,
            selfUserPublicId: this.client.user.id,
        });
        connection.once("destroyed", () => {
            if (this.current === connection) this.current = null;
        });

        this.current = connection;
        try {
            await connection.connect(options);
        } catch (err) {
            connection.destroy();
            throw err;
        }
        return connection;
    }

    /** Leaves the current voice channel, if any. */
    leave(): void {
        this.current?.destroy();
        this.current = null;
    }
}
