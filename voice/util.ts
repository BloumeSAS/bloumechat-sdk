/**
 * RTP sequence numbers (16-bit) and timestamps (32-bit) wrap around rather
 * than overflow — plain `+ 1` would eventually produce an out-of-range value
 * that corrupts the packet header. RFC 3550 requires wraparound, and real
 * sessions run long enough (a 20ms-per-frame Opus stream wraps its sequence
 * number every ~22 minutes) that this isn't just a theoretical edge case.
 */
export function nextUint16(value: number): number {
    return (value + 1) & 0xffff;
}

export function addUint32(value: number, amount: number): number {
    return (value + amount) >>> 0;
}

/** RFC 3550 §5.1: initial sequence number and timestamp must be random, not predictable. */
export function randomUint16(): number {
    return Math.floor(Math.random() * 0x10000);
}

export function randomUint32(): number {
    return Math.floor(Math.random() * 0x100000000);
}
