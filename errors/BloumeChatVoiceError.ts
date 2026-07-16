import { BloumeChatError } from "./BloumeChatError";

/** Thrown for voice-connection problems: missing FFmpeg, join timeout, negotiation failure, etc. */
export class BloumeChatVoiceError extends BloumeChatError {}
