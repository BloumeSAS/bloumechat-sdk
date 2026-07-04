import { io, Socket } from "socket.io-client";
import { EventEmitter } from "events";
import { User } from "./structures/User";
import { Message } from "./structures/Message";
import { DMChannel } from "./structures/DMChannel";
import { Invite } from "./structures/Invite";
import { Notification } from "./structures/Notification";
import { UserManager } from "./managers/UserManager";
import { GuildManager } from "./managers/GuildManager";
import { ChannelManager } from "./managers/ChannelManager";
import { MemberManager } from "./managers/MemberManager";
import { EmbedBuilder, EmbedPayload } from "./structures/EmbedBuilder";
import { RestManager, type ApiCallOptions } from "./rest/RestManager";
import { GatewayManager } from "./gateway/GatewayManager";
import { BloumeChatAuthError } from "./errors/BloumeChatAuthError";
import type { ActivityData, PresenceData, ProfileUpdateData, ClientEvents } from "./types";

export type { ActivityData, PresenceData, ActivityUpdateData, ProfileUpdateData, ClientEvents } from "./types";
export type { ApiCallOptions } from "./rest/RestManager";

const ALLOWED_HOSTS = new Set(["bloumechat.com", "api.bloumechat.com", "localhost"]);

// ─── Main client ──────────────────────────────────────────────────────────────

/**
 * The main hub for interacting with the BloumeChat API and WebSocket.
 *
 * @example
 * const { BloumeChat } = require('bloumechat');
 * const client = new BloumeChat();
 * client.on('ready', () => console.log('Ready!'));
 * client.login(process.env.BOT_TOKEN);
 */
export class BloumeChat extends EventEmitter {
    /** Bot's own User object (null before login) */
    public user: User | null = null;
    /** Manager for all users encountered */
    public users: UserManager;
    /** Manager for all guilds the bot is in */
    public guilds: GuildManager;
    /** Manager for all channels */
    public channels: ChannelManager;
    /** Manager for server members */
    public members: MemberManager;

    /** Date the client first became ready (null before login) */
    public readyAt: Date | null = null;

    private socket: Socket | null = null;
    private _isReady: boolean = false;

    // Bot token, kept out of enumerable/JSON/inspect output — see #_defineHiddenToken.
    private _token: string | null = null;

    private readonly rest: RestManager;
    private readonly gateway: GatewayManager;

    public readonly baseUrl: string = "https://bloumechat.com/api/v2";
    public readonly socketUrl: string = "https://api.bloumechat.com";
    /* Dev overrides:
    public readonly baseUrl: string = "http://localhost:3000/api/v2";
    public readonly socketUrl: string = "http://localhost:3001"; */

    constructor() {
        super();
        this.users = new UserManager(this);
        this.guilds = new GuildManager(this);
        this.channels = new ChannelManager(this);
        this.members = new MemberManager(this);
        this.rest = new RestManager(this.baseUrl, () => this._token);
        this.gateway = new GatewayManager(this);
        this._defineHiddenToken();
        this._warnIfHostOverridden();
    }

    /**
     * Re-declares `_token` as non-enumerable so `console.log(client)`,
     * `JSON.stringify(client)`, and `util.inspect` never print the raw bot
     * token — a leaked log line is a common way bot tokens end up in CI
     * output or crash-report services.
     */
    private _defineHiddenToken(): void {
        Object.defineProperty(this, "_token", {
            value: null,
            writable: true,
            enumerable: false,
            configurable: false,
        });
    }

    /**
     * A subclass that overrides `baseUrl`/`socketUrl` to a third-party host
     * would silently exfiltrate the bot token to that host on every request.
     * We can't prevent overriding (readonly is a compile-time-only guard in
     * JS), so we warn loudly instead.
     */
    private _warnIfHostOverridden(): void {
        for (const url of [this.baseUrl, this.socketUrl]) {
            try {
                const { hostname, protocol } = new URL(url);
                const isKnownHost = [...ALLOWED_HOSTS].some(h => hostname === h || hostname.endsWith(`.${h}`));
                if (protocol !== "https:" && hostname !== "localhost" && hostname !== "127.0.0.1") {
                    console.warn(`[BloumeChat SDK] Insecure protocol "${protocol}" for ${url} — your bot token will be sent unencrypted.`);
                }
                if (!isKnownHost) {
                    console.warn(
                        `[BloumeChat SDK] baseUrl/socketUrl points to an unrecognized host ("${hostname}"). Your bot token will be sent to this host — make sure this is intentional.`
                    );
                }
            } catch {
                // Malformed URL — let the actual request fail with a clearer error later.
            }
        }
    }

    /** How long (ms) the client has been ready. Returns null if not yet ready. */
    get uptime(): number | null {
        return this.readyAt ? Date.now() - this.readyAt.getTime() : null;
    }

    /** @internal */
    public getSocket(): Socket | null {
        return this.socket;
    }

    /**
     * Builds a safe, non-circular snapshot of the client: redacts the bot token and
     * collapses the manager caches (and the raw socket/user structures, which all hold
     * a back-reference to this client) down to plain summaries. Without this, spreading
     * `this` directly — as a naive redaction shortcut would — keeps those circular
     * `structure.client === this` references intact, and `JSON.stringify()` throws
     * ("Converting circular structure to JSON") the moment any manager has cached data,
     * which defeats the point of a "safe to log" representation.
     */
    private _toSafeSnapshot(): Record<string, unknown> {
        const { users, guilds, channels, members, socket, user, rest, gateway, ...rest2 } = this as any;
        void rest;
        void gateway;
        return {
            ...rest2,
            _token: this._token ? "[REDACTED]" : null,
            user: user ? { id: user.id, username: user.username, tag: user.tag } : null,
            users: `[UserManager cache=${users.cache.size}]`,
            guilds: `[GuildManager cache=${guilds.cache.size}]`,
            channels: `[ChannelManager cache=${channels.cache.size}]`,
            members: `[MemberManager cache=${members.cache.size}]`,
            socket: socket ? "[Socket]" : null,
        };
    }

    /** Redact the token in default Node.js console output (`console.log(client)`). */
    private [Symbol.for("nodejs.util.inspect.custom")]() {
        return this._toSafeSnapshot();
    }

    /** Redact the token if a consumer does `JSON.stringify(client)`. */
    toJSON() {
        return this._toSafeSnapshot();
    }

    // ─── Login / Destroy ─────────────────────────────────────────────────────

    /**
     * Connects the bot to BloumeChat using the provided bot token.
     */
    async login(token: string): Promise<void> {
        if (!token || typeof token !== "string") {
            throw new BloumeChatAuthError("login() requires a non-empty bot token string.");
        }
        this._token = token;

        return new Promise((resolve, reject) => {
            this.socket = io(this.socketUrl, {
                auth: { token },
                transports: ["websocket"],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1_000,
                reconnectionDelayMax: 30_000,
            });

            // All "just forward this event" / cache-mutation wiring lives in
            // GatewayManager — this client only owns the ready-sequencing below.
            this.gateway.attach(this.socket);

            this.socket.on("connect", () => {
                if (this._isReady) {
                    this.emit("reconnect");
                    return;
                }
                this.fetchSelf()
                    .then(async botUser => {
                        this.user = botUser;
                        await this.guilds.fetchAll();
                        this._isReady = true;
                        this.readyAt = new Date();
                        this.emit("ready");
                        resolve();
                    })
                    .catch(reject);
            });

            this.socket.on("connect_error", error => {
                this.emit("error", error);
                if (!this._isReady) reject(error);
            });
        });
    }

    /**
     * Disconnects the bot and cleans up all listeners.
     */
    destroy(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this._isReady = false;
        this.readyAt = null;
        this._token = null;
        this.removeAllListeners();
    }

    // ─── API helper ──────────────────────────────────────────────────────────

    /**
     * Makes a raw authenticated call to the BloumeChat REST API.
     *
     * Requests are queued behind a small concurrency limit, time out after
     * `timeoutMs` (default 15s), and automatically retry with exponential
     * backoff on network errors or 429/502/503/504 responses (respecting a
     * `Retry-After` header when present).
     */
    public async apiCall(path: string, options: ApiCallOptions = {}): Promise<any> {
        return this.rest.request(path, options);
    }

    // ─── Messaging ───────────────────────────────────────────────────────────

    /**
     * Sends a message to a channel by its public ID.
     * Accepts a plain string, an EmbedBuilder, or a full payload object.
     */
    async sendMessage(
        channelId: string,
        options:
            | string
            | EmbedBuilder
            | { content?: string; embeds?: Array<EmbedBuilder | EmbedPayload | Record<string, unknown>>; replyToId?: string }
    ): Promise<Message> {
        if (!this.socket) throw new BloumeChatAuthError("sendMessage() requires an active connection — call login() first.");

        let content = "";
        let embeds: Array<EmbedPayload | Record<string, unknown>> = [];
        let replyToId: string | undefined;

        if (typeof options === "string") {
            content = options;
        } else if (options instanceof EmbedBuilder) {
            embeds = [options.toJSON()];
        } else {
            content = options.content ?? "";
            embeds = (options.embeds || []).map(e =>
                e instanceof EmbedBuilder ? e.toJSON() : (e as EmbedPayload | Record<string, unknown>)
            );
            replyToId = options.replyToId;
        }

        // Guard against accidentally sending an empty message with no embeds —
        // the server would reject it anyway, but failing fast avoids a 10s
        // wait for a socket ack that will never come.
        if (!content && embeds.length === 0) {
            throw new BloumeChatAuthError("sendMessage requires non-empty content or at least one embed.");
        }

        const nonce = Math.random().toString(36).substring(2, 15);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.off("message", onMessage);
                reject(new Error("sendMessage timeout after 10s"));
            }, 10_000);

            const onMessage = (message: Message) => {
                if ((message as any).nonce === nonce) {
                    clearTimeout(timeout);
                    this.off("message", onMessage);
                    resolve(message);
                }
            };

            this.on("message", onMessage);
            this.socket!.emit("message:send", { channelPublicId: channelId, content, embeds, replyToId, nonce });
        });
    }

    // ─── Presence ────────────────────────────────────────────────────────────

    /**
     * Sets the bot's rich presence activity.
     * Pass `null` to clear.
     */
    async setActivity(activity: ActivityData | null): Promise<void> {
        if (!this.socket) throw new BloumeChatAuthError("setActivity() requires an active connection — call login() first.");
        if (activity === null) {
            this.socket.emit("activity:update", { type: "none", name: "" });
            return;
        }
        this.socket.emit("activity:update", {
            type: activity.type,
            name: activity.name.substring(0, 128),
            details: activity.details?.substring(0, 64),
            startedAt: activity.startedAt ?? Date.now(),
        });
    }

    /**
     * Sets the bot's presence status.
     */
    async setStatus(status: "online" | "idle" | "dnd" | "invisible"): Promise<void> {
        if (!this.socket) throw new BloumeChatAuthError("setStatus() requires an active connection — call login() first.");
        this.socket.emit("presence:update", { status });
        if (this.user) this.user.status = status;
        await this.apiCall("/users/settings", { method: "PATCH", body: JSON.stringify({ status }) });
    }

    /**
     * Sets the bot's full presence (status + activity) in one call.
     */
    async setPresence(data: PresenceData): Promise<void> {
        if (!this.socket) throw new BloumeChatAuthError("setPresence() requires an active connection — call login() first.");
        if (data.status) await this.setStatus(data.status);
        if (data.activity !== undefined) await this.setActivity(data.activity);
    }

    // ─── Profile ─────────────────────────────────────────────────────────────

    /**
     * Updates the bot's profile (username, bio, tag, avatar, banner…).
     */
    async updateProfile(data: ProfileUpdateData): Promise<void> {
        await this.apiCall("/users/settings", { method: "PATCH", body: JSON.stringify(data) });
        if (this.user) {
            if (data.name) this.user.username = data.name;
            if (data.tag !== undefined) this.user.tag = data.tag ?? this.user.tag;
            if (data.image !== undefined) this.user.avatar = data.image;
        }
    }

    /** Shortcut: change the bot's avatar URL. */
    async setAvatar(imageUrl: string | null): Promise<void> {
        return this.updateProfile({ image: imageUrl });
    }

    /** Shortcut: change the bot's banner image URL. */
    async setBanner(banner: string | null): Promise<void> {
        return this.updateProfile({ banner });
    }

    /** Shortcut: change the bot's bio. */
    async setBio(bio: string | null): Promise<void> {
        return this.updateProfile({ bio });
    }

    // ─── Direct Messages ─────────────────────────────────────────────────────

    /**
     * Opens or creates a DM channel with a user by their public ID.
     *
     * @example
     * const dm = await client.createDM('USER_PUBLIC_ID');
     * await dm.send('Hello!');
     */
    async createDM(userId: string): Promise<DMChannel> {
        const data = await this.apiCall(`/channels/dm/${userId}`);
        return new DMChannel(this, data);
    }

    // ─── Invites / Server joining ─────────────────────────────────────────────

    /**
     * Resolves an invite code to get server information (read-only).
     *
     * A bot cannot join servers on its own — it must be added by a user who
     * has the permission to do so. Use this to inspect an invite or to obtain
     * an Invite object you can revoke (with MANAGE_INVITES).
     */
    async fetchInvite(code: string): Promise<Invite> {
        const data = await this.apiCall(`/invites/${code}`);
        return new Invite(this, code, data);
    }

    // ─── Notifications ────────────────────────────────────────────────────────

    /**
     * Fetches all unread notifications.
     */
    async fetchNotifications(): Promise<Notification[]> {
        const data = await this.apiCall("/notifications/unread");
        return (data.notifications || []).map((n: any) => new Notification(this, n));
    }

    // ─── Search ───────────────────────────────────────────────────────────────

    /**
     * Searches messages in a channel by keyword.
     *
     * @example
     * const results = await client.searchMessages('CHANNEL_ID', 'hello world');
     */
    async searchMessages(channelId: string, query: string, options?: { limit?: number }): Promise<Message[]> {
        const q = new URLSearchParams({ q: query });
        if (options?.limit) q.append("limit", options.limit.toString());
        const data = await this.apiCall(`/chat/${channelId}/search?${q.toString()}`);
        return (data.messages || []).map((m: any) => new Message(this, m));
    }

    // ─── Internals ────────────────────────────────────────────────────────────

    private async fetchSelf(): Promise<User> {
        const data = await this.apiCall("/auth/me");
        const user = new User(this, data.user);
        this.users.cache.set(user.id, user);
        return user;
    }
}

/**
 * Type-only augmentation: teaches TypeScript the exact payload shape for
 * every event name so `client.on("messageCreate", msg => ...)` infers `msg:
 * Message` instead of `any`. Runtime behavior is unchanged (EventEmitter is
 * untyped at runtime); this only affects compile-time checking for consumers
 * of the published `.d.ts`.
 */
export declare interface BloumeChat {
    on<K extends keyof ClientEvents>(event: K, listener: (...args: ClientEvents[K]) => void): this;
    once<K extends keyof ClientEvents>(event: K, listener: (...args: ClientEvents[K]) => void): this;
    off<K extends keyof ClientEvents>(event: K, listener: (...args: ClientEvents[K]) => void): this;
    emit<K extends keyof ClientEvents>(event: K, ...args: ClientEvents[K]): boolean;
}
