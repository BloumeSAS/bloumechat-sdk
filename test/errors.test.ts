import { describe, expect, it } from "vitest";
import { BloumeChatError } from "../errors/BloumeChatError";
import { BloumeChatAPIError } from "../errors/BloumeChatAPIError";
import { BloumeChatAuthError } from "../errors/BloumeChatAuthError";
import { BloumeChatTimeoutError } from "../errors/BloumeChatTimeoutError";
import { RateLimitError } from "../errors/RateLimitError";

describe("Error hierarchy", () => {
    it("every SDK error is an instance of BloumeChatError and Error", () => {
        const errors = [
            new BloumeChatAuthError("bad token"),
            new BloumeChatAPIError(500, "/foo", "boom"),
            new BloumeChatTimeoutError("/foo", 15000),
            new RateLimitError("/foo", "slow down", 1000),
        ];
        for (const err of errors) {
            expect(err).toBeInstanceOf(Error);
            expect(err).toBeInstanceOf(BloumeChatError);
        }
    });

    it("RateLimitError is also a BloumeChatAPIError (429), but not every APIError is a RateLimitError", () => {
        const rateLimited = new RateLimitError("/foo", "slow down", 1000);
        const serverError = new BloumeChatAPIError(500, "/foo", "boom");

        expect(rateLimited).toBeInstanceOf(BloumeChatAPIError);
        expect(rateLimited.status).toBe(429);
        expect(serverError).not.toBeInstanceOf(RateLimitError);
    });

    it("sets .name to the concrete class name, not the generic \"Error\"", () => {
        expect(new BloumeChatAuthError("x").name).toBe("BloumeChatAuthError");
        expect(new BloumeChatAPIError(404, "/x", "").name).toBe("BloumeChatAPIError");
        expect(new RateLimitError("/x", "", null).name).toBe("RateLimitError");
    });

    it("BloumeChatAPIError exposes status/path/and a truncated body", () => {
        const longBody = "x".repeat(1000);
        const err = new BloumeChatAPIError(503, "/servers/1", longBody);

        expect(err.status).toBe(503);
        expect(err.path).toBe("/servers/1");
        expect(err.body).toBe(longBody); // full body preserved on the instance
        expect(err.message).toContain("503");
        expect(err.message.length).toBeLessThan(longBody.length); // message itself is truncated
    });

    it("RateLimitError carries retryAfterMs (or null when the API didn't send one)", () => {
        expect(new RateLimitError("/x", "", 2500).retryAfterMs).toBe(2500);
        expect(new RateLimitError("/x", "", null).retryAfterMs).toBeNull();
    });

    it("BloumeChatTimeoutError carries the path and configured timeout", () => {
        const err = new BloumeChatTimeoutError("/slow", 15000);
        expect(err.path).toBe("/slow");
        expect(err.timeoutMs).toBe(15000);
        expect(err.message).toContain("15000ms");
    });
});
