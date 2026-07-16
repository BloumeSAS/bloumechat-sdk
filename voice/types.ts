/**
 * Wire-format types for BloumeChat's voice system. Mirrored by hand from
 * `server-nest/src/voice/voice.types.ts` and
 * `server-nest/src/gateway/voice/voice-signaling.types.ts` — the SDK can't
 * import server-side source directly, so these shapes must be kept in sync
 * manually whenever the server-side voice payloads change.
 */

/** A participant's live state inside a voice channel, as broadcast by the server. */
export interface VoiceUser {
    userPublicId: string;
    userName: string;
    userTag: string;
    userImage: string | null;
    socketId: string;
    muted: boolean;
    deafened: boolean;
    speaking: boolean;
    /** Epoch ms this user joined the channel — used for call-duration display. */
    joinedAt: number;
    isStreaming: boolean;
    isCameraOn: boolean;
    cameraStreamId?: string | null;
    screenStreamId?: string | null;
    cameraTrackId?: string | null;
    screenTrackId?: string | null;
}

/** Partial voice state a client can push via `voice:state`. */
export interface VoiceStateUpdate {
    muted?: boolean;
    deafened?: boolean;
    speaking?: boolean;
    isStreaming?: boolean;
    isCameraOn?: boolean;
    cameraStreamId?: string | null;
    screenStreamId?: string | null;
    cameraTrackId?: string | null;
    screenTrackId?: string | null;
}

/** Payload of `voice:user-joined`. */
export interface VoiceUserJoinedData {
    channelPublicId: string;
    user: VoiceUser;
    users: VoiceUser[];
}

/** Payload of `voice:user-left`. */
export interface VoiceUserLeftData {
    channelPublicId: string;
    userPublicId: string;
    users: VoiceUser[];
}

/** Payload of `voice:user-state`. */
export interface VoiceUserStateData extends VoiceStateUpdate {
    channelPublicId: string;
    userPublicId: string;
}

/** Payload of `voice:state-update` (bulk snapshot) and the reply to `voice:get-users`. */
export interface VoiceUsersSnapshot {
    channelPublicId: string;
    users: VoiceUser[];
    startedAt?: number;
}

/** Payload of `voice:incoming-call`. */
export interface VoiceIncomingCallData {
    channelPublicId: string;
    fromUser: { userPublicId: string; userName: string; userImage: string | null };
}

/** Payload of `voice:call-cancelled`. */
export interface VoiceCallCancelledData {
    channelPublicId: string;
}

/**
 * Opaque WebRTC signaling payload relayed 1:1 between peers via `voice:signal`.
 * The server never inspects it, only relays it — `signal` is an
 * `RTCSessionDescriptionInit` (for "offer"/"answer") or an `RTCIceCandidateInit`
 * (for "ice-candidate"), matching what the browser client sends.
 */
export interface WebRTCSignalData {
    targetUserPublicId: string;
    signal: unknown;
    type: "offer" | "answer" | "ice-candidate";
}

/** Payload received on `voice:signal` (server adds `fromUserPublicId`). */
export interface WebRTCSignalReceived {
    fromUserPublicId: string;
    signal: unknown;
    type: "offer" | "answer" | "ice-candidate";
}

/** A single ICE server entry, as returned by `GET /voice/ice-servers`. */
export interface IceServerData {
    urls: string | string[];
    username?: string;
    credential?: string;
}

/** Options accepted by {@link Channel.join}. */
export interface VoiceJoinOptions {
    /** Join self-muted (no outgoing audio sent). Default `false`. */
    selfMute?: boolean;
    /** Join self-deafened (incoming audio ignored). Default `false`. */
    selfDeaf?: boolean;
    /** Max time (ms) to wait for the server to confirm the join. Default 15000. */
    timeoutMs?: number;
}

/** A playable audio source: a local file path, an http(s) URL, or a raw PCM/encoded Readable stream. */
export type AudioResource = string | NodeJS.ReadableStream;

export interface PlayOptions {
    /**
     * How to interpret `resource`:
     * - `"auto"` (default): let FFmpeg sniff the format (works for files, URLs and most streams).
     * - `"raw"`: `resource` is already signed 16-bit little-endian PCM, 48kHz stereo — skips FFmpeg entirely.
     */
    inputType?: "auto" | "raw";
    /** Linear volume multiplier applied before Opus encoding (1 = unchanged, 0 = silent). Default 1. */
    volume?: number;
    /** Extra arguments spliced into the FFmpeg invocation right after `-i <input>`. Advanced use only. */
    ffmpegArgs?: string[];
}

export type VoiceConnectionState = "connecting" | "ready" | "destroyed";
