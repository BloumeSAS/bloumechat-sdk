import { EventEmitter } from "events";
import type { BloumeChat } from "../bloumechat";
import type { User } from "./User";
import type { ReactionInfo } from "../gateway/ReactionDiffTracker";

export interface ReactionCollectorOptions {
    /** Only `collect` reactions this returns `true` for. */
    filter?: (reaction: ReactionInfo, user: User) => boolean;
    /** Stop collecting after this many milliseconds. */
    time?: number;
    /** Stop collecting once this many reactions have been collected. */
    max?: number;
}

/**
 * Collects `messageReactionAdd` events scoped to a single message, until
 * `time`/`max` is hit or `stop()` is called. A thin wrapper around the
 * client's own event stream — cheap to create, always cleans up its
 * listener on end so it's safe to create-and-forget per message.
 *
 * @example
 * const collector = message.createReactionCollector({ time: 60_000 });
 * collector.on('collect', (reaction, user) => console.log(`${user.tagString} reacted ${reaction.emoji}`));
 * collector.on('end', reason => console.log(`Stopped: ${reason}`));
 */
export class ReactionCollector extends EventEmitter {
    private count = 0;
    private ended = false;
    private readonly timeout: ReturnType<typeof setTimeout> | null;
    private readonly onAdd: (reaction: ReactionInfo, user: User, messagePublicId: string) => void;

    constructor(
        private readonly client: BloumeChat,
        private readonly messageId: string,
        private readonly options: ReactionCollectorOptions = {}
    ) {
        super();

        this.onAdd = (reaction, user, messagePublicId) => {
            if (this.ended || messagePublicId !== this.messageId) return;
            if (this.options.filter && !this.options.filter(reaction, user)) return;

            this.count++;
            this.emit("collect", reaction, user);

            if (this.options.max && this.count >= this.options.max) this.stop("limit");
        };
        this.client.on("messageReactionAdd", this.onAdd);

        this.timeout = this.options.time ? setTimeout(() => this.stop("time"), this.options.time) : null;
    }

    /** Stops collecting and emits `end` with the given reason (defaults to `"user"`). */
    stop(reason = "user"): void {
        if (this.ended) return;
        this.ended = true;
        if (this.timeout) clearTimeout(this.timeout);
        this.client.off("messageReactionAdd", this.onAdd);
        this.emit("end", reason);
    }
}

export declare interface ReactionCollector {
    on(event: "collect", listener: (reaction: ReactionInfo, user: User) => void): this;
    on(event: "end", listener: (reason: string) => void): this;
}
