/**
 * Base class for every error the SDK throws intentionally (as opposed to
 * network/runtime errors bubbling up from `fetch`/`socket.io-client`).
 * Lets consumers do `catch (e) { if (e instanceof BloumeChatError) ... }` to
 * distinguish "the SDK told you something went wrong" from unrelated bugs.
 */
export class BloumeChatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = new.target.name;
        // Restores the correct prototype chain when compiled down to older
        // targets (a known TS-to-ES5 gotcha with extending built-ins).
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
