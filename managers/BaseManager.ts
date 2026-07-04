import { BloumeChat } from "../bloumechat";
import { Collection } from "../util/Collection";

/**
 * The base manager for all SDK managers.
 */
export class BaseManager<K, V> {
    /**
     * The client that instantiated this manager.
     */
    public readonly client: BloumeChat;

    /**
     * The cache of items for this manager.
     */
    public cache: Collection<K, V>;

    constructor(client: BloumeChat) {
        this.client = client;
        this.cache = new Collection<K, V>();
    }

    /**
     * Resolves an ID to an object.
     */
    resolve(id: K): V | undefined {
        return this.cache.get(id);
    }
}
