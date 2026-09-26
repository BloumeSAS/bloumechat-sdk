export interface ReactionSnapshotEntry {
    publicId: string;
    emoji: string;
    userPublicId: string;
    userName: string | null;
    messagePublicId: string;
}

/** A single emoji's current state on a message, passed alongside each add/remove event. */
export interface ReactionInfo {
    emoji: string;
    messagePublicId: string;
    /** How many users currently have this emoji on the message (after this change). */
    count: number;
}

interface ReactionDelta {
    info: ReactionInfo;
    userPublicId: string;
    userName: string | null;
}

interface DiffResult {
    added: ReactionDelta[];
    removed: ReactionDelta[];
}

/**
 * The `message:reaction` gateway event always carries the message's FULL
 * current reaction list, not a delta — there's no signal for who just
 * toggled what, or whether it was an add or a remove. This tracker keeps the
 * last-seen list per message and diffs each new snapshot against it to
 * recover individual add/remove events, the way `messageReactionAdd` /
 * `messageReactionRemove` promise.
 *
 * The first snapshot ever seen for a message (nothing cached yet — e.g. the
 * bot wasn't connected for earlier reactions on it) is reported as a batch
 * of adds; there's no way to distinguish "brand new" from "already there"
 * without a message-history fetch, which this SDK doesn't do for reactions.
 */
export class ReactionDiffTracker {
    // messagePublicId -> emoji -> Set<userPublicId>
    private readonly state = new Map<string, Map<string, Set<string>>>();
    // messagePublicId -> userPublicId -> last-known display name
    private readonly userNames = new Map<string, Map<string, string | null>>();

    diff(messagePublicId: string, reactions: ReactionSnapshotEntry[]): DiffResult {
        const previous = this.state.get(messagePublicId) ?? new Map<string, Set<string>>();
        const names = this.userNames.get(messagePublicId) ?? new Map<string, string | null>();

        const next = new Map<string, Set<string>>();
        for (const r of reactions) {
            if (!next.has(r.emoji)) next.set(r.emoji, new Set());
            next.get(r.emoji)!.add(r.userPublicId);
            names.set(r.userPublicId, r.userName ?? null);
        }

        const added: ReactionDelta[] = [];
        const removed: ReactionDelta[] = [];

        const emojis = new Set([...previous.keys(), ...next.keys()]);
        for (const emoji of emojis) {
            const before = previous.get(emoji) ?? new Set<string>();
            const after = next.get(emoji) ?? new Set<string>();
            const info: ReactionInfo = { emoji, messagePublicId, count: after.size };

            for (const userPublicId of after) {
                if (!before.has(userPublicId)) added.push({ info, userPublicId, userName: names.get(userPublicId) ?? null });
            }
            for (const userPublicId of before) {
                if (!after.has(userPublicId)) removed.push({ info, userPublicId, userName: names.get(userPublicId) ?? null });
            }
        }

        this.state.set(messagePublicId, next);
        this.userNames.set(messagePublicId, names);

        return { added, removed };
    }

    /** Drops all cached state for a message — call on deletion or a full reaction clear. */
    clear(messagePublicId: string): void {
        this.state.delete(messagePublicId);
        this.userNames.delete(messagePublicId);
    }
}
