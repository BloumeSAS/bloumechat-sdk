import { EventEmitter } from "events";
import type { Socket } from "socket.io-client";
import { BloumeChatVoiceError } from "../errors/BloumeChatVoiceError";
import { AudioPlayer } from "./AudioPlayer";
import { VoicePeerConnection } from "./VoicePeerConnection";
import type {
    AudioResource,
    IceServerData,
    PlayOptions,
    VoiceConnectionState,
    VoiceJoinOptions,
    VoiceStateUpdate,
    VoiceUser,
    VoiceUserJoinedData,
    VoiceUserLeftData,
    VoiceUserStateData,
    WebRTCSignalReceived,
} from "./types";

export interface VoiceConnectionOptions {
    socket: Socket;
    channelId: string;
    selfUserPublicId: string;
    iceServers: IceServerData[];
}

/**
 * A live connection to one voice channel. Returned by {@link Channel.join}.
 *
 * Owns one {@link VoicePeerConnection} per other participant (BloumeChat voice
 * is a peer-to-peer mesh, not an SFU — see `server-nest/src/voice/`) and one
 * shared {@link AudioPlayer} whose output frames are fanned out to all of them,
 * so joining a busy channel opens one real WebRTC connection per participant.
 */
export class VoiceConnection extends EventEmitter {
    public readonly channelId: string;
    public state: VoiceConnectionState = "connecting";

    private readonly socket: Socket;
    private readonly selfUserPublicId: string;
    private readonly iceServers: IceServerData[];
    private readonly peers = new Map<string, VoicePeerConnection>();
    private readonly users = new Map<string, VoiceUser>();
    private readonly player: AudioPlayer;
    private destroyed = false;

    constructor(options: VoiceConnectionOptions) {
        super();
        this.socket = options.socket;
        this.channelId = options.channelId;
        this.selfUserPublicId = options.selfUserPublicId;
        this.iceServers = options.iceServers;

        this.player = new AudioPlayer(() => this.peers.values());
        this.player.on("error", err => this.emit("error", err));
        // A single persistent listener (not one per play() call) — play() can
        // interrupt an in-flight track, which itself emits "finish" for the
        // interrupted track, so a once()-per-call listener would fire early.
        this.player.on("start", () => {
            this.setState({ speaking: true });
            this.emit("playerStart");
        });
        this.player.on("finish", () => {
            this.setState({ speaking: false });
            this.emit("playerFinish");
        });

        this.attachSocketListeners();
    }

    // ─── Lifecycle ───────────────────────────────────────────────────────

    /** Resolves once the server confirms the join and every already-present participant has a peer connection under negotiation. */
    async connect(options: VoiceJoinOptions = {}): Promise<void> {
        const timeoutMs = options.timeoutMs ?? 15_000;

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.socket.off("voice:user-joined", onJoined);
                reject(new BloumeChatVoiceError(`Timed out joining voice channel ${this.channelId} after ${timeoutMs}ms.`));
            }, timeoutMs);

            const onJoined = (data: VoiceUserJoinedData) => {
                if (data.channelPublicId !== this.channelId || data.user.userPublicId !== this.selfUserPublicId) return;
                clearTimeout(timeout);
                this.socket.off("voice:user-joined", onJoined);

                for (const user of data.users) {
                    this.users.set(user.userPublicId, user);
                    // We're the newcomer here — we proactively open a connection to
                    // every user already in the room (they'll answer, not offer).
                    if (user.userPublicId !== this.selfUserPublicId) this.ensurePeer(user.userPublicId, false);
                }
                this.state = "ready";
                this.emit("ready");
                resolve();
            };

            this.socket.on("voice:user-joined", onJoined);
            this.socket.emit("voice:join", { channelPublicId: this.channelId });
        });

        if (options.selfMute || options.selfDeaf) {
            this.setState({ muted: options.selfMute, deafened: options.selfDeaf });
        }
    }

    /** Leaves the channel and tears down every peer connection. Safe to call more than once. */
    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.state = "destroyed";

        this.player.stop();
        for (const peer of this.peers.values()) peer.close();
        this.peers.clear();
        this.users.clear();
        this.detachSocketListeners();

        if (this.socket.connected) this.socket.emit("voice:leave");
        this.emit("destroyed");
        this.removeAllListeners();
    }

    // ─── Participants ────────────────────────────────────────────────────

    /** Currently known participants (including this bot). */
    get participants(): VoiceUser[] {
        return [...this.users.values()];
    }

    // ─── State ───────────────────────────────────────────────────────────

    setState(state: VoiceStateUpdate): void {
        this.socket.emit("voice:state", state);
    }

    setMuted(muted: boolean): void {
        this.setState({ muted });
    }

    setDeafened(deafened: boolean): void {
        this.setState({ deafened });
    }

    // ─── Playback ────────────────────────────────────────────────────────

    /** Plays a file path, URL, or raw PCM stream — decoded via FFmpeg (unless `inputType: "raw"`) and broadcast to every connected peer. */
    play(resource: AudioResource, options?: PlayOptions): void {
        this.player.play(resource, options);
    }

    pause(): void {
        this.player.pause();
    }

    resume(): void {
        this.player.resume();
    }

    stopPlaying(): void {
        this.player.stop();
    }

    setVolume(volume: number): void {
        this.player.setVolume(volume);
    }

    get isPlaying(): boolean {
        return this.player.isPlaying;
    }

    get isPaused(): boolean {
        return this.player.isPaused;
    }

    // ─── Internals ───────────────────────────────────────────────────────

    private ensurePeer(userPublicId: string, suppressInitialNegotiation: boolean): VoicePeerConnection {
        const existing = this.peers.get(userPublicId);
        if (existing) return existing;

        // Both sides must compute politeness the same deterministic way (a
        // total order on publicId) or they could both end up polite/impolite.
        const polite = this.selfUserPublicId.localeCompare(userPublicId) > 0;
        const peer = new VoicePeerConnection({
            remoteUserPublicId: userPublicId,
            polite,
            iceServers: this.iceServers,
            suppressInitialNegotiation,
            onSignal: (type, signal) => {
                this.socket.emit("voice:signal", { targetUserPublicId: userPublicId, signal, type });
            },
        });
        peer.on("error", err => this.emit("error", err));
        peer.on("audioPacket", (payload: Buffer) => this.emit("audioPacket", userPublicId, payload));
        this.peers.set(userPublicId, peer);
        return peer;
    }

    private closePeer(userPublicId: string): void {
        const peer = this.peers.get(userPublicId);
        if (!peer) return;
        peer.close();
        this.peers.delete(userPublicId);
    }

    private attachSocketListeners(): void {
        this.socket.on("voice:user-joined", this.handleUserJoined);
        this.socket.on("voice:user-left", this.handleUserLeft);
        this.socket.on("voice:user-state", this.handleUserState);
        this.socket.on("voice:signal", this.handleSignal);
    }

    private detachSocketListeners(): void {
        this.socket.off("voice:user-joined", this.handleUserJoined);
        this.socket.off("voice:user-left", this.handleUserLeft);
        this.socket.off("voice:user-state", this.handleUserState);
        this.socket.off("voice:signal", this.handleSignal);
    }

    // Someone else joined after we did — the newcomer initiates by sending us
    // an offer, which we pick up reactively in handleSignal below (matches
    // the browser client: only the newcomer proactively opens connections).
    private handleUserJoined = (data: VoiceUserJoinedData): void => {
        if (data.channelPublicId !== this.channelId) return;
        this.users.set(data.user.userPublicId, data.user);
        if (data.user.userPublicId !== this.selfUserPublicId) this.emit("userJoined", data.user);
    };

    private handleUserLeft = (data: VoiceUserLeftData): void => {
        if (data.channelPublicId !== this.channelId) return;
        if (data.userPublicId === this.selfUserPublicId) {
            this.destroy();
            return;
        }
        this.users.delete(data.userPublicId);
        this.closePeer(data.userPublicId);
        this.emit("userLeft", data.userPublicId);
    };

    private handleUserState = (data: VoiceUserStateData): void => {
        if (data.channelPublicId !== this.channelId) return;
        const existing = this.users.get(data.userPublicId);
        if (existing) Object.assign(existing, data);
        this.emit("userStateUpdate", data);
    };

    private handleSignal = (data: WebRTCSignalReceived): void => {
        const peer = this.ensurePeer(data.fromUserPublicId, data.type === "offer");
        void peer.handleSignal(data.type, data.signal);
    };
}
