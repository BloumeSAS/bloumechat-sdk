export interface EmbedAuthor {
    name: string;
    url?: string;
    iconUrl?: string;
}

export interface EmbedFooter {
    text: string;
    iconUrl?: string;
}

export interface EmbedImage {
    url: string;
}

export interface EmbedThumbnail {
    url: string;
}

export interface EmbedField {
    name: string;
    value: string;
    inline?: boolean;
}

export interface EmbedPayload {
    title?: string;
    description?: string;
    url?: string;
    timestamp?: string;
    color?: number | string;
    footer?: EmbedFooter;
    image?: EmbedImage;
    thumbnail?: EmbedThumbnail;
    author?: EmbedAuthor;
    fields?: EmbedField[];
}

export class EmbedBuilder {
    private data: EmbedPayload = {};

    constructor(data?: EmbedPayload) {
        if (data) this.data = { ...data };
    }

    setTitle(title: string | null): this {
        if (title === null) delete this.data.title;
        else this.data.title = title;
        return this;
    }

    setDescription(description: string | null): this {
        if (description === null) delete this.data.description;
        else this.data.description = description;
        return this;
    }

    setURL(url: string | null): this {
        if (url === null) delete this.data.url;
        else this.data.url = url;
        return this;
    }

    setTimestamp(timestamp?: Date | number | null): this {
        if (timestamp === null) {
            delete this.data.timestamp;
            return this;
        }
        if (!timestamp) timestamp = new Date();
        this.data.timestamp = new Date(timestamp).toISOString();
        return this;
    }

    setColor(color: number | string | null): this {
        if (color === null) {
            delete this.data.color;
            return this;
        }

        // Convert hex strings like "#0099ff" to number or store as string
        if (typeof color === 'string' && color.startsWith('#')) {
            color = parseInt(color.replace('#', ''), 16);
        }

        this.data.color = color;
        return this;
    }

    setFooter(options: EmbedFooter | null): this {
        if (options === null) delete this.data.footer;
        else this.data.footer = { ...options };
        return this;
    }

    setImage(url: string | null): this {
        if (url === null) delete this.data.image;
        else this.data.image = { url };
        return this;
    }

    setThumbnail(url: string | null): this {
        if (url === null) delete this.data.thumbnail;
        else this.data.thumbnail = { url };
        return this;
    }

    setAuthor(options: EmbedAuthor | null): this {
        if (options === null) delete this.data.author;
        else this.data.author = { ...options };
        return this;
    }

    addFields(...fields: EmbedField[]): this {
        if (!this.data.fields) this.data.fields = [];
        this.data.fields.push(...fields);
        return this;
    }

    setFields(...fields: EmbedField[]): this {
        this.data.fields = [...fields];
        return this;
    }

    spliceFields(index: number, deleteCount: number, ...fields: EmbedField[]): this {
        if (!this.data.fields) this.data.fields = [];
        this.data.fields.splice(index, deleteCount, ...fields);
        return this;
    }

    /**
     * Serializes the builder to API-compatible JSON payload.
     */
    toJSON(): EmbedPayload {
        return { ...this.data };
    }
}
