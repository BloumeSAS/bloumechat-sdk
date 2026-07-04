import { BloumeChatError } from "./BloumeChatError";

/** Thrown for authentication problems: missing/invalid token, calling a method before login(), etc. */
export class BloumeChatAuthError extends BloumeChatError {}
