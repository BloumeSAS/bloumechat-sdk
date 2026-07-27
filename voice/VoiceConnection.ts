import { EventEmitter } from "events";
import type { Socket } from "socket.io-client";
import {
    Room,
    RoomEvent,
    LocalAudioTrack,
    AudioSource,
    AudioStream,
    TrackSource,
    TrackKind,
    TrackPublishOptions,
    type RoomOptions,
    type RemoteTrack,
    type RemoteTrackPublication,
    type RemoteParticipant,
} from "@livekit/rtc-node";
import { BloumeChatVoiceError } from "../errors/BloumeChatVoiceError";
import { AudioPlayer } from "./AudioPlayer";
import type {
    AudioResource,
    LiveKitTokenData,
    PlayOptions,
    VoiceConnectionState,
    VoiceJoinOptions,
    VoiceStateUpdate,
    VoiceUser,
    VoiceUserJoinedData,
    VoiceUserLeftData,
    VoiceUserStateData,
} from "./types";

export interface VoiceConnectionOptions {
    socket: Socket;
    channelId: string;
    selfUserPublicId: string;
}

/** 48kHz stereo — matches BloumeChat's browser client and every WebRTC participant. */
const SAMPLE_RATE = 48000;
const CHANNELS = 2;

/**
 * A live connection to one voice channel. Returned by {@link Channel.join}.
 *
 * Connects to BloumeChat's self-hosted LiveKit SFU via `@livekit/rtc-node` —
 * the same media transport the browser client uses (`livekit-client`), not a
 * peer-to-peer mesh. The bot publishes one shared audio track for its speech
 * (fanned out to every participant by the SFU, not one connection per
 * participant) and can subscribe to every other participant's audio for
 * incoming-audio use cases (e.g. speech-to-text).
 */
export class VoiceConnection extends EventEmitter {
    public readonly channelId: string;
    public state: VoiceConnectionState = "connecting";

    private readonly socket: Socket;
    private readonly selfUserPublicId: string;
    private readonly users = new Map<string, VoiceUser>();
    private readonly player: AudioPlayer;
    private room: Room | null = null;
    private audioSource: AudioSource | null = null;
    private localTrack: LocalAudioTrack | null = null;
    private readonly audioStreams = new Map<string, AudioStream>();
    private destroyed = false;

    constructor(options: VoiceConnectionOptions) {
        super();
        this.socket = options.socket;
        this.channelId = options.channelId;
        this.selfUserPublicId = options.selfUserPublicId;

        this.player = new AudioPlayer(() => this.audioSource);
        this.player.on("error", err => this.emit("error", err));
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

    /** Resolves once the LiveKit room connection is established and the local audio track is published. */
    async connect(options: VoiceJoinOptions = {}): Promise<void> {
        const timeoutMs = options.timeoutMs ?? 15_000;

        const tokenData = await new Promise<LiveKitTokenData>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.socket.off("voice:livekit-token", onToken);
                reject(new BloumeChatVoiceError(`Timed out joining voice channel ${this.channelId} after ${timeoutMs}ms.`));
            }, timeoutMs);

            const onToken = (data: LiveKitTokenData) => {
                if (data.channelPublicId !== this.channelId) return;
                clearTimeout(timeout);
                this.socket.off("voice:livekit-token", onToken);
                resolve(data);
            };

            this.socket.on("voice:livekit-token", onToken);
            this.socket.emit("voice:join", { channelPublicId: this.channelId });
        });

        const room = new Room();
        this.room = room;

        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
            if (track.kind !== TrackKind.KIND_AUDIO) return;
            const stream = new AudioStream(track, SAMPLE_RATE, CHANNELS);
            this.audioStreams.set(participant.identity, stream);
            void this.pumpAudioStream(participant.identity, stream);
        });

        room.on(
            RoomEvent.TrackUnsubscribed,
            (_track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
                this.audioStreams.delete(participant.identity);
            }
        );

        const connectOptions: RoomOptions = {
            autoSubscribe: true,
            dynacast: true,
            ...(tokenData.e2eeKey ? { encryption: { keyProviderOptions: { sharedKey: base64ToBytes(tokenData.e2eeKey) } } } : {}),
        };

        await room.connect(tokenData.url, tokenData.token, connectOptions);

        this.audioSource = new AudioSource(SAMPLE_RATE, CHANNELS);
        this.localTrack = LocalAudioTrack.createAudioTrack("bot-audio", this.audioSource);
        await room.localParticipant?.publishTrack(this.localTrack, new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }));

        this.state = "ready";
        this.emit("ready");

        if (options.selfMute || options.selfDeaf) {
            this.setState({ muted: options.selfMute, deafened: options.selfDeaf });
        }
    }

    /** Leaves the channel and disconnects from LiveKit. Safe to call more than once. */
    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.state = "destroyed";

        this.player.stop();
        this.audioStreams.clear();
        void this.room?.disconnect();
        this.room = null;
        this.audioSource = null;
        this.localTrack = null;
        this.users.clear();
        this.detachSocketListeners();

        if (this.socket.connected) this.socket.emit("voice:leave");
        this.emit("destroyed");
        this.removeAllListeners();
    }

    // ─── Participants ────────────────────────────────────────────────────

    /** Currently known participants (including this bot) — presence/badge state from the socket layer, independent of LiveKit. */
    get participants(): VoiceUser[] {
        return [...this.users.values()];
    }

    // ─── State ───────────────────────────────────────────────────────────

    /** Presence state (mute/deafen/speaking/camera/stream badges) — unrelated to the LiveKit media transport, always goes through the socket. */
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

    /** Plays a file path, URL, or raw PCM stream — decoded to PCM via FFmpeg (unless `inputType: "raw"`) and published as this bot's LiveKit audio track. */
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

    /** Emits decoded PCM frames from a remote participant's audio as `"audioFrame"` — e.g. for speech-to-text. Runs until the stream closes (participant leaves / track unsubscribed). */
    private async pumpAudioStream(userPublicId: string, stream: AudioStream): Promise<void> {
        try {
            for await (const frame of stream) {
                if (this.destroyed) return;
                this.emit("audioFrame", userPublicId, frame.data, frame.sampleRate, frame.channels);
            }
        } catch (err) {
            if (!this.destroyed) this.emit("error", err);
        }
    }

    private attachSocketListeners(): void {
        this.socket.on("voice:user-joined", this.handleUserJoined);
        this.socket.on("voice:user-left", this.handleUserLeft);
        this.socket.on("voice:user-state", this.handleUserState);
    }

    private detachSocketListeners(): void {
        this.socket.off("voice:user-joined", this.handleUserJoined);
        this.socket.off("voice:user-left", this.handleUserLeft);
        this.socket.off("voice:user-state", this.handleUserState);
    }

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
        this.emit("userLeft", data.userPublicId);
    };

    private handleUserState = (data: VoiceUserStateData): void => {
        if (data.channelPublicId !== this.channelId) return;
        const existing = this.users.get(data.userPublicId);
        if (existing) Object.assign(existing, data);
        this.emit("userStateUpdate", data);
    };
}

function base64ToBytes(base64: string): Uint8Array {
    return Uint8Array.from(Buffer.from(base64, "base64"));
}
