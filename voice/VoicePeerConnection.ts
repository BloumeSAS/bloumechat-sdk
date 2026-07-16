import { EventEmitter } from "events";
import {
    MediaStreamTrack,
    RTCPeerConnection,
    RtpHeader,
    RtpPacket,
    type RTCIceCandidateInit,
    type RTCSessionDescriptionInit,
} from "werift";
import type { IceServerData } from "./types";

export interface VoicePeerConnectionOptions {
    /** publicId of the remote user this connection negotiates with. */
    remoteUserPublicId: string;
    /**
     * Perfect-negotiation politeness (WebRTC spec pattern): the polite side backs
     * off and accepts an incoming offer even mid-negotiation; the impolite side
     * ignores a colliding offer and pursues its own. Must be computed the same
     * way on both ends (BloumeChat's browser client compares `publicId.localeCompare`)
     * or the two sides can both end up polite/impolite and negotiation stalls.
     */
    polite: boolean;
    iceServers: IceServerData[];
    onSignal: (type: "offer" | "answer" | "ice-candidate", signal: unknown) => void;
    /**
     * Werift (like the browser) fires `onnegotiationneeded` asynchronously
     * (via `setImmediate`) after `addTrack()`, not synchronously. When this
     * peer is created reactively — specifically to answer an offer that just
     * arrived — that deferred callback fires AFTER we've already applied the
     * incoming offer and sent our answer, and would otherwise be misread as
     * "renegotiate" and fire a spurious second offer. Set this when the
     * caller is about to immediately feed in an offer via {@link handleSignal}.
     */
    suppressInitialNegotiation?: boolean;
}

/**
 * One leg of the voice mesh: a single WebRTC connection to a single remote
 * participant. BloumeChat voice is peer-to-peer (no SFU) — joining a channel
 * with N other participants means creating N of these.
 *
 * Implements the "Perfect Negotiation" pattern (same as
 * `webapp/components/features/voice-manager.tsx`) so it interops correctly
 * with real browser clients regardless of who happens to signal first.
 */
export class VoicePeerConnection extends EventEmitter {
    public readonly remoteUserPublicId: string;
    public readonly pc: RTCPeerConnection;
    /** This bot's outgoing audio track for this peer — fed via {@link writeAudioFrame}. */
    public readonly audioTrack: MediaStreamTrack;

    private readonly polite: boolean;
    private readonly onSignal: VoicePeerConnectionOptions["onSignal"];
    private makingOffer = false;
    private ignoreOffer = false;
    private closed = false;
    private suppressNextNegotiation: boolean;

    constructor(options: VoicePeerConnectionOptions) {
        super();
        this.remoteUserPublicId = options.remoteUserPublicId;
        this.polite = options.polite;
        this.onSignal = options.onSignal;
        this.suppressNextNegotiation = options.suppressInitialNegotiation ?? false;

        this.pc = new RTCPeerConnection({
            iceServers: flattenIceServers(options.iceServers),
        });

        this.audioTrack = new MediaStreamTrack({ kind: "audio" });
        this.pc.addTrack(this.audioTrack);

        this.pc.onicecandidate = event => {
            if (event.candidate) this.onSignal("ice-candidate", event.candidate);
        };

        this.pc.onnegotiationneeded = async () => {
            if (this.suppressNextNegotiation) {
                this.suppressNextNegotiation = false;
                return;
            }
            try {
                this.makingOffer = true;
                await this.pc.setLocalDescription();
                this.onSignal("offer", this.pc.localDescription);
            } catch (err) {
                this.emit("error", err);
            } finally {
                this.makingOffer = false;
            }
        };

        this.pc.onconnectionstatechange = () => {
            this.emit("stateChange", this.pc.connectionState);
            if (this.pc.connectionState === "failed" || this.pc.connectionState === "closed") {
                this.emit(this.pc.connectionState);
            } else if (this.pc.connectionState === "connected") {
                this.emit("connected");
            }
        };

        this.pc.ontrack = event => {
            // Bots don't decode incoming audio by default (no consumer for it yet),
            // but raw Opus RTP is surfaced so a bot author can do their own decoding
            // (e.g. speech-to-text) without the SDK forcing an opinion on that.
            event.track.onReceiveRtp.subscribe((rtp: RtpPacket) => {
                this.emit("audioPacket", rtp.payload);
            });
        };
    }

    /** Feeds one 20ms Opus frame into this peer's outgoing audio stream. */
    writeAudioFrame(payload: Buffer, sequenceNumber: number, timestamp: number): void {
        if (this.closed) return;
        const header = new RtpHeader({ sequenceNumber, timestamp });
        this.audioTrack.writeRtp(new RtpPacket(header, payload));
    }

    /** Applies an incoming signal relayed via `voice:signal`. */
    async handleSignal(type: "offer" | "answer" | "ice-candidate", signal: unknown): Promise<void> {
        if (this.closed) return;
        try {
            if (type === "ice-candidate") {
                await this.pc.addIceCandidate(signal as RTCIceCandidateInit);
                return;
            }

            const description = signal as RTCSessionDescriptionInit;
            const offerCollision = type === "offer" && (this.makingOffer || this.pc.signalingState !== "stable");
            this.ignoreOffer = !this.polite && offerCollision;
            if (this.ignoreOffer) return;

            await this.pc.setRemoteDescription(description);
            if (type === "offer") {
                await this.pc.setLocalDescription();
                this.onSignal("answer", this.pc.localDescription);
            }
        } catch (err) {
            this.emit("error", err);
        }
    }

    close(): void {
        if (this.closed) return;
        this.closed = true;
        this.audioTrack.stop();
        this.pc.close().catch(() => {});
        this.removeAllListeners();
    }
}

/** werift's `RTCIceServer.urls` is a single string — the browser-facing API allows an array per entry. */
function flattenIceServers(servers: IceServerData[]): Array<{ urls: string; username?: string; credential?: string }> {
    const flattened: Array<{ urls: string; username?: string; credential?: string }> = [];
    for (const server of servers) {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        for (const url of urls) {
            flattened.push({ urls: url, username: server.username, credential: server.credential });
        }
    }
    return flattened;
}
