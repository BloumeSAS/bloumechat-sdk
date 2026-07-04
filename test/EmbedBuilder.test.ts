import { describe, expect, it } from "vitest";
import { EmbedBuilder } from "../structures/EmbedBuilder";

describe("EmbedBuilder", () => {
    it("builds a full payload via chained setters", () => {
        const embed = new EmbedBuilder()
            .setTitle("Title")
            .setDescription("Description")
            .setURL("https://bloumechat.com")
            .setColor("#0099ff")
            .setFooter({ text: "Footer" })
            .setImage("https://cdn.bloume.chat/image.png")
            .setThumbnail("https://cdn.bloume.chat/thumb.png")
            .setAuthor({ name: "Author" })
            .addFields({ name: "Field 1", value: "Value 1", inline: true });

        expect(embed.toJSON()).toEqual({
            title: "Title",
            description: "Description",
            url: "https://bloumechat.com",
            color: 0x0099ff,
            footer: { text: "Footer" },
            image: { url: "https://cdn.bloume.chat/image.png" },
            thumbnail: { url: "https://cdn.bloume.chat/thumb.png" },
            author: { name: "Author" },
            fields: [{ name: "Field 1", value: "Value 1", inline: true }],
        });
    });

    it("passing null to a setter clears that field", () => {
        const embed = new EmbedBuilder().setTitle("Title").setTitle(null);
        expect(embed.toJSON()).toEqual({});
    });

    it("converts hex color strings to a numeric value", () => {
        expect(new EmbedBuilder().setColor("#ff0000").toJSON().color).toBe(0xff0000);
    });

    it("accepts a numeric color as-is", () => {
        expect(new EmbedBuilder().setColor(0x00ff00).toJSON().color).toBe(0x00ff00);
    });

    it("setTimestamp() defaults to now and serializes to ISO", () => {
        const before = Date.now();
        const embed = new EmbedBuilder().setTimestamp();
        const iso = embed.toJSON().timestamp as string;
        const parsed = new Date(iso).getTime();

        expect(parsed).toBeGreaterThanOrEqual(before);
        expect(parsed).toBeLessThanOrEqual(Date.now());
    });

    it("setTimestamp(null) removes the timestamp", () => {
        const embed = new EmbedBuilder().setTimestamp().setTimestamp(null);
        expect(embed.toJSON().timestamp).toBeUndefined();
    });

    it("addFields() appends without overwriting previous fields", () => {
        const embed = new EmbedBuilder().addFields({ name: "A", value: "1" }).addFields({ name: "B", value: "2" });

        expect(embed.toJSON().fields).toEqual([
            { name: "A", value: "1" },
            { name: "B", value: "2" },
        ]);
    });

    it("setFields() replaces any existing fields", () => {
        const embed = new EmbedBuilder().addFields({ name: "A", value: "1" }).setFields({ name: "B", value: "2" });

        expect(embed.toJSON().fields).toEqual([{ name: "B", value: "2" }]);
    });

    it("spliceFields() removes and inserts fields at a given index", () => {
        const embed = new EmbedBuilder().setFields({ name: "A", value: "1" }, { name: "B", value: "2" }, { name: "C", value: "3" });
        embed.spliceFields(1, 1, { name: "B2", value: "20" });

        expect(embed.toJSON().fields).toEqual([
            { name: "A", value: "1" },
            { name: "B2", value: "20" },
            { name: "C", value: "3" },
        ]);
    });

    it("constructor accepts a pre-existing payload and toJSON() returns a defensive copy", () => {
        const initial = { title: "Preset" };
        const embed = new EmbedBuilder(initial);
        const json = embed.toJSON();

        expect(json).toEqual({ title: "Preset" });
        json.title = "Mutated";
        expect(embed.toJSON().title).toBe("Preset");
    });
});
