import { BaseManager } from "./BaseManager";
import type { BloumeChat } from "../bloumechat";
import type { VoiceState, VoiceUser } from "../voice/types";

/**
 * Tracks which voice channel each user currently occupies, keyed by
 * userPublicId. BloumeChat has no REST endpoint for "current voice state" —
 * this cache is populated entirely from the `voice:*` gateway events
 * forwarded by {@link GatewayManager}, so it becomes authoritative for a
 * channel once the bot has received at least one snapshot for it (e.g. by
 * joining that channel, or from any `voice:user-joined`/`voice:user-left`/
 * `voice:state-update` broadcast the bot happens to receive).
 *
 * Exposed as `client.voiceStates` and via the `Member.voice` shorthand.
 */
export class VoiceStateManager extends BaseManager<string, VoiceState> {
    constructor(client: BloumeChat) {
        super(client);
    }

    /** Replaces the cached entries for one channel with a fresh full snapshot. */
    _applySnapshot(channelId: string, users: VoiceUser[]): void {
        for (const [userId, state] of this.cache) {
            if (state.channelId === channelId) this.cache.delete(userId);
        }
        for (const user of users) {
            this.cache.set(user.userPublicId, { ...user, channelId });
        }
    }

    /** Merges a partial state update (e.g. mute/deafen/speaking toggle) into the cached entry, if any. */
    _patch(userPublicId: string, patch: Partial<VoiceUser>): void {
        const current = this.cache.get(userPublicId);
        if (current) this.cache.set(userPublicId, { ...current, ...patch });
    }

    /** Removes a user's cached voice state (they left every voice channel). */
    _remove(userPublicId: string): void {
        this.cache.delete(userPublicId);
    }
}
