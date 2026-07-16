import { EventEmitter } from "events";
import * as prism from "prism-media";
import type { Readable } from "stream";
import { BloumeChatVoiceError } from "../errors/BloumeChatVoiceError";
import type { VoicePeerConnection } from "./VoicePeerConnection";
import type { AudioResource, PlayOptions } from "./types";
import { addUint32, nextUint16, randomUint16, randomUint32 } from "./util";

const FRAME_DURATION_MS = 20;
/** 48kHz * 20ms — the Opus frame size BloumeChat's browser client (and every WebRTC peer) expects. */
const SAMPLES_PER_FRAME = 960;
/** Stop reading from the encoder once this many frames (~2s) are buffered, to bound memory on a slow/stalled connection. */
const MAX_QUEUED_FRAMES = 100;
/** Resume reading once the buffer drains back below this. */
const RESUME_QUEUED_FRAMES = 40;

/**
 * Decodes an audio resource (file path, URL, or raw PCM stream) to Opus and
 * dispatches one frame every 20ms to every currently-connected voice peer —
 * the same pipeline shape `@discordjs/voice` uses, adapted for a WebRTC mesh
 * (every peer gets its own `writeAudioFrame` call per tick, since there's no
 * single SFU endpoint to hand the stream to).
 */
export class AudioPlayer extends EventEmitter {
    private ffmpeg: prism.FFmpeg | null = null;
    private encoder: prism.opus.Encoder | null = null;
    private volumeTransformer: prism.VolumeTransformer | null = null;

    private readonly frameQueue: Buffer[] = [];
    private streamEnded = false;
    private playing = false;
    private paused = false;
    private pausedAt: number | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;

    private sequenceNumber = randomUint16();
    private timestamp = randomUint32();
    private frameIndex = 0;
    private startTime = 0;

    constructor(private readonly getPeers: () => Iterable<VoicePeerConnection>) {
        super();
    }

    get isPlaying(): boolean {
        return this.playing && !this.paused;
    }

    get isPaused(): boolean {
        return this.paused;
    }

    play(resource: AudioResource, options: PlayOptions = {}): void {
        this.stop();

        const volume = options.volume ?? 1;
        const inputType = options.inputType ?? "auto";

        let pcmSource: Readable;
        if (inputType === "raw") {
            if (typeof resource === "string") {
                throw new BloumeChatVoiceError('play() with inputType "raw" requires a Readable PCM stream, not a string path/URL.');
            }
            pcmSource = resource as Readable;
        } else {
            const args = [
                "-analyzeduration",
                "0",
                "-loglevel",
                "0",
                "-i",
                typeof resource === "string" ? resource : "-",
                ...(options.ffmpegArgs ?? []),
                "-f",
                "s16le",
                "-ar",
                "48000",
                "-ac",
                "2",
            ];
            let ffmpeg: prism.FFmpeg;
            try {
                ffmpeg = new prism.FFmpeg({ args });
            } catch {
                throw new BloumeChatVoiceError(
                    "FFmpeg was not found on PATH. Voice playback requires FFmpeg to be installed — see https://ffmpeg.org/download.html (or install the `ffmpeg-static` npm package in your bot project)."
                );
            }
            this.ffmpeg = ffmpeg;
            if (typeof resource !== "string") (resource as Readable).pipe(ffmpeg as unknown as NodeJS.WritableStream);
            ffmpeg.on("error", err => this.emit("error", err));
            pcmSource = ffmpeg as unknown as Readable;
        }

        this.volumeTransformer = new prism.VolumeTransformer({ type: "s16le", volume });
        this.encoder = new prism.opus.Encoder({ rate: 48000, channels: 2, frameSize: SAMPLES_PER_FRAME });

        pcmSource.pipe(this.volumeTransformer).pipe(this.encoder);

        this.encoder.on("data", (chunk: Buffer) => {
            this.frameQueue.push(chunk);
            if (this.frameQueue.length >= MAX_QUEUED_FRAMES) this.encoder?.pause();
        });
        this.encoder.on("end", () => {
            this.streamEnded = true;
        });
        this.encoder.on("error", err => this.emit("error", err));
        this.volumeTransformer.on("error", err => this.emit("error", err));

        this.playing = true;
        this.paused = false;
        this.streamEnded = false;
        this.frameIndex = 0;
        this.startTime = Date.now();
        this.emit("start");
        this.scheduleTick();
    }

    /** Freezes playback in place (no frames sent, position preserved) until {@link resume}. */
    pause(): void {
        if (!this.playing || this.paused) return;
        this.paused = true;
        this.pausedAt = Date.now();
        if (this.timer) clearTimeout(this.timer);
    }

    resume(): void {
        if (!this.playing || !this.paused) return;
        // Shift the clock forward by however long we were paused, so the
        // drift-correction math in `tick()` doesn't treat the pause as
        // "falling behind" and fire a burst of catch-up frames.
        if (this.pausedAt !== null) this.startTime += Date.now() - this.pausedAt;
        this.paused = false;
        this.pausedAt = null;
        this.scheduleTick();
    }

    setVolume(volume: number): void {
        this.volumeTransformer?.setVolume(volume);
    }

    /** Stops playback and releases the decode/encode pipeline. Safe to call when nothing is playing. */
    stop(): void {
        const wasPlaying = this.playing;
        this.playing = false;
        this.paused = false;
        this.pausedAt = null;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.frameQueue.length = 0;
        this.streamEnded = false;

        this.ffmpeg?.process?.kill("SIGKILL");
        this.ffmpeg = null;
        this.encoder?.removeAllListeners();
        this.encoder?.destroy();
        this.encoder = null;
        this.volumeTransformer?.destroy();
        this.volumeTransformer = null;

        if (wasPlaying) this.emit("finish");
    }

    private scheduleTick(): void {
        if (!this.playing || this.paused) return;
        const nextFrameTime = this.startTime + this.frameIndex * FRAME_DURATION_MS;
        const delay = Math.max(0, nextFrameTime - Date.now());
        this.timer = setTimeout(() => this.tick(), delay);
    }

    private tick(): void {
        if (!this.playing || this.paused) return;

        const frame = this.frameQueue.shift();
        if (this.encoder?.isPaused() && this.frameQueue.length <= RESUME_QUEUED_FRAMES) this.encoder.resume();

        if (!frame) {
            if (this.streamEnded) {
                this.stop();
                return;
            }
            // Decoder underrun (source can't keep up with real time) — hold this
            // frame slot and retry shortly rather than ending playback early.
            this.frameIndex++;
            this.scheduleTick();
            return;
        }

        for (const peer of this.getPeers()) {
            peer.writeAudioFrame(frame, this.sequenceNumber, this.timestamp);
        }
        this.sequenceNumber = nextUint16(this.sequenceNumber);
        this.timestamp = addUint32(this.timestamp, SAMPLES_PER_FRAME);

        this.frameIndex++;
        this.scheduleTick();
    }
}
