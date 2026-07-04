import { describe, expect, it } from "vitest";
import { Collection } from "../util/Collection";

function makeCollection(): Collection<string, number> {
    return new Collection<string, number>([
        ["a", 1],
        ["b", 2],
        ["c", 3],
    ]);
}

describe("Collection", () => {
    it("first() returns the first inserted value", () => {
        expect(makeCollection().first()).toBe(1);
    });

    it("first() returns undefined when empty", () => {
        expect(new Collection().first()).toBeUndefined();
    });

    it("last() returns the last inserted value", () => {
        expect(makeCollection().last()).toBe(3);
    });

    it("last() returns undefined when empty", () => {
        expect(new Collection().last()).toBeUndefined();
    });

    it("filter() returns a new Collection with only matching entries", () => {
        const filtered = makeCollection().filter(v => v > 1);
        expect(filtered).toBeInstanceOf(Collection);
        expect(filtered.toArray()).toEqual([2, 3]);
        // original untouched
        expect(makeCollection().size).toBe(3);
    });

    it("map() transforms every entry into a plain array", () => {
        expect(makeCollection().map(v => v * 10)).toEqual([10, 20, 30]);
    });

    it("find() returns the first matching value or undefined", () => {
        expect(makeCollection().find(v => v === 2)).toBe(2);
        expect(makeCollection().find(v => v === 99)).toBeUndefined();
    });

    it("some() / every() behave like their Array counterparts", () => {
        const col = makeCollection();
        expect(col.some(v => v === 2)).toBe(true);
        expect(col.some(v => v === 99)).toBe(false);
        expect(col.every(v => v > 0)).toBe(true);
        expect(col.every(v => v > 1)).toBe(false);
    });

    it("every() is vacuously true on an empty collection", () => {
        expect(new Collection().every(() => false)).toBe(true);
    });

    it("reduce() accumulates a single value", () => {
        expect(makeCollection().reduce((acc, v) => acc + v, 0)).toBe(6);
    });

    it("toArray() / keyArray() expose values and keys as plain arrays", () => {
        const col = makeCollection();
        expect(col.toArray()).toEqual([1, 2, 3]);
        expect(col.keyArray()).toEqual(["a", "b", "c"]);
    });

    it("isEmpty() reflects the collection size", () => {
        expect(new Collection().isEmpty()).toBe(true);
        expect(makeCollection().isEmpty()).toBe(false);
    });

    it("random() returns a member of the collection, or undefined when empty", () => {
        const col = makeCollection();
        const value = col.random();
        expect(value === undefined || col.toArray().includes(value)).toBe(true);
        expect(new Collection().random()).toBeUndefined();
    });

    it("concat() merges two collections, with the argument's entries taking priority", () => {
        const base = makeCollection();
        const other = new Collection<string, number>([
            ["b", 200],
            ["d", 4],
        ]);
        const merged = base.concat(other);

        expect(merged.toArray().sort()).toEqual([1, 200, 3, 4].sort());
        expect(merged.get("b")).toBe(200);
        // originals are untouched
        expect(base.get("b")).toBe(2);
        expect(base.size).toBe(3);
    });

    it("sorted() returns a new, ordered Collection without mutating the original", () => {
        const col = makeCollection();
        const descending = col.sorted((a, b) => b - a);

        expect(descending.toArray()).toEqual([3, 2, 1]);
        // original insertion order is preserved
        expect(col.toArray()).toEqual([1, 2, 3]);
    });

    it("sorted() with no comparator preserves relative order (stable, no-op compare)", () => {
        const col = makeCollection();
        expect(col.sorted().toArray()).toEqual([1, 2, 3]);
    });
});
