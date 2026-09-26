import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Collection } from "./Collection";

/**
 * A bot command loaded by {@link loadCommandsFromDirectory} / `client.loadCommands()`.
 * Extra fields (cooldown, guildOnly, aliases handling, …) are entirely up to
 * the bot — the SDK only cares about `name` and `execute`.
 */
export interface Command {
    name: string;
    aliases?: string[];
    execute: (...args: any[]) => unknown | Promise<unknown>;
    [key: string]: unknown;
}

const COMMAND_FILE_EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".ts"]);

/**
 * Loads every command module in `directoryPath` (non-recursive) into a
 * `Collection<name, Command>`. Each file's default export (or a named
 * `command` export) must have a string `name` and a function `execute` —
 * anything else is skipped with a console warning rather than failing the
 * whole load, so one broken command file doesn't take the bot down.
 *
 * Uses dynamic `import()` (not `require()`) so it works whether the bot
 * project is CommonJS or ESM. Loading `.ts` files directly requires the
 * bot's own runtime to already have a TypeScript loader registered (e.g.
 * `tsx`, `ts-node/esm`) — without one, those files fail to load and are
 * skipped with a warning, same as any other bad file.
 */
export async function loadCommandsFromDirectory(directoryPath: string): Promise<Collection<string, Command>> {
    const commands = new Collection<string, Command>();

    let entries: string[];
    try {
        entries = readdirSync(directoryPath);
    } catch (error) {
        throw new Error(`loadCommands(): could not read directory "${directoryPath}" (${(error as Error).message}).`, { cause: error });
    }

    for (const file of entries) {
        const ext = file.slice(file.lastIndexOf("."));
        if (!COMMAND_FILE_EXTENSIONS.has(ext)) continue;

        const fullPath = join(directoryPath, file);
        try {
            const mod = await import(pathToFileURL(fullPath).href);
            const command: Command | undefined = mod?.default ?? mod?.command;

            if (!command || typeof command.name !== "string" || typeof command.execute !== "function") {
                console.warn(`[BloumeChat SDK] loadCommands(): skipping "${file}" — missing a string "name" or function "execute".`);
                continue;
            }

            commands.set(command.name, command);
        } catch (error) {
            console.warn(`[BloumeChat SDK] loadCommands(): failed to load "${file}": ${(error as Error).message}`);
        }
    }

    return commands;
}
