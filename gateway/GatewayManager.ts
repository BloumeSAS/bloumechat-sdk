import type { Socket } from "socket.io-client";
import type { BloumeChat } from "../bloumechat";
import type { ActivityUpdateData } from "../types";
import { Message } from "../structures/Message";
import { Role } from "../structures/Role";

/**
 * Wires every "forward this socket event to the client" and cache-mutation
 * listener onto an already-created socket. Deliberately does NOT own the
 * connection lifecycle (connect/connect_error/the ready sequence) — that's
 * client orchestration (fetchSelf, guilds.fetchAll, resolving login()'s
 * promise, telling reconnects apart from first connects) and stays in
 * `BloumeChat.login()`. This class is purely the dispatch table.
 */
export class GatewayManager {
    constructor(private readonly client: BloumeChat) {}

    attach(socket: Socket): void {
        const client = this.client;

        socket.on("disconnect", reason => client.emit("disconnect", reason));

        // ── Messages ──────────────────────────────────────────────────
        socket.on("message:new", data => {
            const message = new Message(client, data);
            client.emit("messageCreate", message);
            client.emit("message", message);
        });
        socket.on("message:updated", data => client.emit("messageUpdate", data));
        socket.on("message:deleted", data => client.emit("messageDelete", data));
        socket.on("message:reaction", data => client.emit("messageReactionAdd", data));
        socket.on("message:reaction_clear", data => client.emit("messageReactionRemoveAll", data));
        socket.on("message:pinned", data => client.emit("messagePin", data));

        // ── Guilds ────────────────────────────────────────────────────
        socket.on("server:updated", data => client.emit("guildUpdate", data));
        socket.on("server:deleted", data => client.emit("guildDelete", data));
        socket.on("server:member_add", data => client.emit("guildMemberAdd", data));
        socket.on("server:member_remove", data => client.emit("guildMemberRemove", data));
        socket.on("server:member_removed", data => {
            client.emit("guildMemberRemove", data);
            // The server reuses this single event for both kicks and bans,
            // distinguished only by `reason` — surface bans as their own
            // event so bot authors don't have to string-match `reason` themselves.
            if (data?.reason === "banned") client.emit("guildBanAdd", data);
        });
        socket.on("server:member_update", data => client.emit("guildMemberUpdate", data));
        socket.on("server:ban_revoked", data => client.emit("guildBanRemove", data));
        socket.on("server:you_removed", data => client.emit("guildDelete", data));
        socket.on("server:you_left", data => client.emit("guildDelete", data));
        socket.on("server:channels_updated", data => client.emit("guildChannelsUpdate", data));
        socket.on("server:categories_updated", data => client.emit("guildCategoriesUpdate", data));
        socket.on("server:role_create", data => {
            const guild = client.guilds.cache.get(data.serverPublicId);
            if (guild) {
                const role = new Role(client, data.role);
                guild.roles.cache.set(role.id, role);
                client.emit("roleCreate", role);
            }
        });
        socket.on("server:role_update", data => {
            const guild = client.guilds.cache.get(data.serverPublicId);
            if (guild) {
                const role = new Role(client, data.role);
                guild.roles.cache.set(role.id, role);
                client.emit("roleUpdate", role);
            }
        });
        socket.on("server:role_delete", data => {
            const guild = client.guilds.cache.get(data.serverPublicId);
            if (guild) {
                const role = guild.roles.cache.get(data.rolePublicId);
                guild.roles.cache.delete(data.rolePublicId);
                client.emit("roleDelete", role || data.rolePublicId);
            }
        });
        socket.on("server:roles_order_update", data => {
            const guild = client.guilds.cache.get(data.serverPublicId);
            if (guild && data.roles) {
                for (const r of data.roles) {
                    const cached = guild.roles.cache.get(r.publicId);
                    if (cached) {
                        cached.position = r.position;
                    }
                }
                client.emit("roleOrderUpdate", data);
            }
        });

        // ── Users / Presence ──────────────────────────────────────────
        socket.on("user:update", data => client.emit("userUpdate", data));
        socket.on("typing:start", data => client.emit("typingStart", data));
        socket.on("typing:stop", data => client.emit("typingStop", data));
        socket.on("presence:update", data => client.emit("presenceUpdate", data));

        // ── Activity (RPC) ────────────────────────────────────────────
        socket.on("activity:update", (data: ActivityUpdateData) => client.emit("activityUpdate", data));

        // ── Voice ─────────────────────────────────────────────────────
        socket.on("voice:state-update", data => client.emit("voiceStateUpdate", data));
        socket.on("voice:user-left", data => client.emit("voiceStateUpdate", data));

        // ── DMs / Notifications ───────────────────────────────────────
        socket.on("dm:new", data => client.emit("dmNew", data));
        socket.on("notification:new", data => client.emit("notificationNew", data));
    }
}
