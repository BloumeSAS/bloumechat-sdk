import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, DEFAULT_PERMISSIONS, PermissionFlags } from "../util/Permissions";

describe("PermissionFlags", () => {
    it("every flag is a distinct bit (no accidental overlap)", () => {
        const values = Object.values(PermissionFlags);
        const seenBits = new Set<bigint>();

        for (const flag of values) {
            for (const seen of seenBits) {
                expect(flag & seen).toBe(0n);
            }
            seenBits.add(flag);
        }
    });

    it("every flag is a non-zero power of two", () => {
        for (const flag of Object.values(PermissionFlags)) {
            expect(flag > 0n).toBe(true);
            expect(flag & (flag - 1n)).toBe(0n);
        }
    });

    it("DEFAULT_PERMISSIONS is a combination of the expected baseline flags", () => {
        expect(DEFAULT_PERMISSIONS & PermissionFlags.VIEW_CHANNELS).toBe(PermissionFlags.VIEW_CHANNELS);
        expect(DEFAULT_PERMISSIONS & PermissionFlags.SEND_MESSAGES).toBe(PermissionFlags.SEND_MESSAGES);
        expect(DEFAULT_PERMISSIONS & PermissionFlags.ADMINISTRATOR).toBe(0n);
    });

    it("ALL_PERMISSIONS contains every individual flag", () => {
        for (const flag of Object.values(PermissionFlags)) {
            expect(ALL_PERMISSIONS & flag).toBe(flag);
        }
    });

    it("bitwise OR combines flags, bitwise AND checks membership", () => {
        const perms = PermissionFlags.VIEW_CHANNELS | PermissionFlags.SEND_MESSAGES;
        expect((perms & PermissionFlags.VIEW_CHANNELS) === PermissionFlags.VIEW_CHANNELS).toBe(true);
        expect((perms & PermissionFlags.BAN_MEMBERS) === PermissionFlags.BAN_MEMBERS).toBe(false);
    });
});
