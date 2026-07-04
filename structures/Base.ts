import { BloumeChat } from "../bloumechat";

/**
 * The base class for all structures.
 */
export class Base {
    /**
     * The client that instantiated this structure.
     */
    public readonly client: BloumeChat;

    constructor(client: BloumeChat) {
        this.client = client;
    }

    /**
     * Clones the structure.
     */
    protected _clone() {
        return Object.assign(Object.create(this), this);
    }

    /**
     * Updates the structure with new data.
     */
    protected _patch(data: any) {
        return data;
    }
}
