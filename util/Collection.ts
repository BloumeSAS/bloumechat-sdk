/**
 * A Map with additional utility methods, similar to discord.js Collections.
 */
export class Collection<K, V> extends Map<K, V> {
    /**
     * Returns the first element of the collection, or `undefined` if empty.
     */
    first(): V | undefined {
        return this.values().next().value;
    }

    /**
     * Returns the last element of the collection, or `undefined` if empty.
     */
    last(): V | undefined {
        const arr = Array.from(this.values());
        return arr[arr.length - 1];
    }

    /**
     * Filters the collection and returns a new Collection with matching entries.
     */
    filter(fn: (value: V, key: K, collection: this) => boolean): Collection<K, V> {
        const results = new Collection<K, V>();
        for (const [key, val] of this) {
            if (fn(val, key, this)) results.set(key, val);
        }
        return results;
    }

    /**
     * Maps each entry and returns an array of results.
     */
    map<T>(fn: (value: V, key: K, collection: this) => T): T[] {
        const results: T[] = [];
        for (const [key, val] of this) {
            results.push(fn(val, key, this));
        }
        return results;
    }

    /**
     * Finds the first value satisfying the predicate, or `undefined`.
     */
    find(fn: (value: V, key: K, collection: this) => boolean): V | undefined {
        for (const [key, val] of this) {
            if (fn(val, key, this)) return val;
        }
        return undefined;
    }

    /**
     * Returns `true` if **at least one** entry satisfies the predicate.
     */
    some(fn: (value: V, key: K, collection: this) => boolean): boolean {
        for (const [key, val] of this) {
            if (fn(val, key, this)) return true;
        }
        return false;
    }

    /**
     * Returns `true` if **every** entry satisfies the predicate.
     * Returns `true` for an empty collection (vacuous truth).
     */
    every(fn: (value: V, key: K, collection: this) => boolean): boolean {
        for (const [key, val] of this) {
            if (!fn(val, key, this)) return false;
        }
        return true;
    }

    /**
     * Reduces the collection to a single value, similar to `Array.prototype.reduce`.
     */
    reduce<T>(fn: (accumulator: T, value: V, key: K, collection: this) => T, initialValue: T): T {
        let acc = initialValue;
        for (const [key, val] of this) {
            acc = fn(acc, val, key, this);
        }
        return acc;
    }

    /**
     * Returns all values as a plain array.
     */
    toArray(): V[] {
        return Array.from(this.values());
    }

    /**
     * Returns all keys as a plain array.
     */
    keyArray(): K[] {
        return Array.from(this.keys());
    }

    /**
     * Returns `true` if the collection has no entries.
     */
    isEmpty(): boolean {
        return this.size === 0;
    }

    /**
     * Returns a random value from the collection, or `undefined` if empty.
     */
    random(): V | undefined {
        const values = Array.from(this.values());
        if (values.length === 0) return undefined;
        return values[Math.floor(Math.random() * values.length)];
    }

    /**
     * Returns a new Collection that is the result of merging this collection with another.
     * Entries from `other` overwrite entries from `this` on key conflict.
     */
    concat(other: Collection<K, V>): Collection<K, V> {
        const result = new Collection<K, V>(this);
        for (const [key, val] of other) {
            result.set(key, val);
        }
        return result;
    }

    /**
     * Sorts the collection by a comparator and returns a **new** Collection.
     * Does not mutate the original.
     */
    sorted(compareFn?: (a: V, b: V) => number): Collection<K, V> {
        const entries = Array.from(this.entries()).sort(([, a], [, b]) => (compareFn ? compareFn(a, b) : 0));
        return new Collection<K, V>(entries);
    }
}
