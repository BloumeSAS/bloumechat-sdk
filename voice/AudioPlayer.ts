import { EventEmitter } from "events";
import * as prism from "prism-media";
import type { Readable } from "stream";
import { AudioFrame, type AudioSource } from "@livekit/rtc-node";
import { BloumeChatVoiceError } from "../errors/BloumeChatVoiceError";
import type { AudioResource, PlayOptions } from "./types";

const FRAME_DURATION_MS = 20;
/** 48kHz * 20ms — the frame size LiveKit (and every WebRTC engine) expects per channel. */
const SAMPLES_PER_FRAME = 960;
const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2; // s16le
const FRAME_BYTES = SAMPLES_PER_FRAME * CHANNELS * BYTES_PER_SAMPLE;
/** Stop reading from the decoder once this many frames (~2s) are buffered, to bound memory on a slow/stalled connection. */
const MAX_QUEUED_FRAMES = 100;
/** Resume reading once the buffer drains back below this. */
const RESUME_QUEUED_FRAMES = 40;

/**
 * Decodes an audio resource (file path, URL, or raw PCM stream) to raw PCM and
 * dispatches one 20ms frame every tick to LiveKit's `AudioSource` — LiveKit's
 * own engine does the Opus encoding and fans the result out to every
 * participant in the room (there's a single shared track now, not one
 * WebRTC leg per peer to feed like the old mesh implementation had).
 */
export class AudioPlayer extends EventEmitter {
    private ffmpeg: prism.FFmpeg | null = null;
    private volumeTransformer: prism.VolumeTransformer | null = null;

    /** Raw PCM bytes not yet long enough to form a full 20ms frame. */
    private pcmRemainder: Buffer = Buffer.alloc(0);
    private readonly frameQueue: Int16Array[] = [];
    private streamEnded = false;
    private playing = false;
    private paused = false;
    private pausedAt: number | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;

    private frameIndex = 0;
    private startTime = 0;

    constructor(private readonly getAudioSource: () => AudioSource | null) {
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
                String(SAMPLE_RATE),
                "-ac",
                String(CHANNELS),
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
        this.volumeTransformer.on("error", err => this.emit("error", err));

        pcmSource.pipe(this.volumeTransformer);

        this.pcmRemainder = Buffer.alloc(0);
        this.volumeTransformer.on("data", (chunk: Buffer) => {
            this.pushPcm(chunk);
            if (this.frameQueue.length >= MAX_QUEUED_FRAMES) this.volumeTransformer?.pause();
        });
        this.volumeTransformer.on("end", () => {
            this.streamEnded = true;
        });

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

    /** Stops playback and releases the decode pipeline. Safe to call when nothing is playing. */
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
        this.pcmRemainder = Buffer.alloc(0);
        this.streamEnded = false;

        this.ffmpeg?.process?.kill("SIGKILL");
        this.ffmpeg = null;
        this.volumeTransformer?.removeAllListeners();
        this.volumeTransformer?.destroy();
        this.volumeTransformer = null;

        if (wasPlaying) this.emit("finish");
    }

    /** Slices incoming PCM into fixed 20ms frames, carrying over any partial tail to the next chunk. */
    private pushPcm(chunk: Buffer): void {
        let buf = this.pcmRemainder.length > 0 ? Buffer.concat([this.pcmRemainder, chunk]) : chunk;
        while (buf.length >= FRAME_BYTES) {
            const frameBytes = buf.subarray(0, FRAME_BYTES);
            const samples = new Int16Array(SAMPLES_PER_FRAME * CHANNELS);
            for (let i = 0; i < samples.length; i++) {
                samples[i] = frameBytes.readInt16LE(i * BYTES_PER_SAMPLE);
            }
            this.frameQueue.push(samples);
            buf = buf.subarray(FRAME_BYTES);
        }
        this.pcmRemainder = Buffer.from(buf);
    }

    private scheduleTick(): void {
        if (!this.playing || this.paused) return;
        const nextFrameTime = this.startTime + this.frameIndex * FRAME_DURATION_MS;
        const delay = Math.max(0, nextFrameTime - Date.now());
        this.timer = setTimeout(() => this.tick(), delay);
    }

    private tick(): void {
        if (!this.playing || this.paused) return;

        const samples = this.frameQueue.shift();
        if (this.volumeTransformer?.isPaused() && this.frameQueue.length <= RESUME_QUEUED_FRAMES) this.volumeTransformer.resume();

        if (!samples) {
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

        const audioSource = this.getAudioSource();
        if (audioSource) {
            const frame = new AudioFrame(samples, SAMPLE_RATE, CHANNELS, SAMPLES_PER_FRAME);
            audioSource.captureFrame(frame).catch(err => this.emit("error", err));
        }

        this.frameIndex++;
        this.scheduleTick();
    }
}
