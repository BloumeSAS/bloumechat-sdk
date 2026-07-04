<p align="center">
  <img src="https://cdn.bloume.chat/favicon.ico" alt="BloumeChat Logo" width="150"/>
</p>

<h1 align="center">BloumeChat SDK</h1>

<p align="center">
  Official JavaScript/TypeScript SDK for <a href="https://bloumechat.com">BloumeChat.com</a>. Build powerful bots, automated systems, and rich integrations with a native, strongly-typed Discord-like syntax.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/bloumechat"><img src="https://img.shields.io/npm/v/bloumechat.svg" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/bloumechat"><img src="https://img.shields.io/npm/dm/bloumechat.svg" alt="NPM Downloads" /></a>
  <a href="https://github.com/BloumeSAS/bloumechat-sdk/actions/workflows/ci.yml"><img src="https://github.com/BloumeSAS/bloumechat-sdk/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/bloumechat"><img src="https://img.shields.io/badge/provenance-verified-brightgreen?logo=npm" alt="npm provenance verified" /></a>
  <a href="https://opensource.org/licenses/ISC"><img src="https://img.shields.io/badge/License-ISC-blue.svg" alt="License: ISC" /></a>
  <a href="https://dev.bloume.chat"><img src="https://img.shields.io/badge/docs-dev.bloume.chat-d946ef.svg" alt="Documentation" /></a>
  <a href="https://github.com/JulesZYTB/bloumechat-bot-starter"><img src="https://img.shields.io/badge/Template-Bot_Starter-success.svg" alt="Bot Template" /></a><br/><br/>
  <a href="https://www.buymeacoffee.com/bloumesas"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=bloumesas&button_colour=BD5FFF&font_colour=ffffff&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00" /></a>
</p>

---

## 🚀 Getting Started

📖 Full developer documentation (guides, API reference) lives at **[dev.bloume.chat](https://dev.bloume.chat)**.

To get started quickly, we provide an official **Bot Starter Template** containing all the necessary architecture (Event handler, Command handler, Documentation).

👉 **[Use the Official Bot Starter Template](https://github.com/JulesZYTB/bloumechat-bot-starter)**

Or, you can install the SDK manually via npm:

```bash
npm install bloumechat
```

---

## 🔒 Provenance & Supply Chain Security

Every published version of `bloumechat` is **built and signed on GitHub Actions** using [npm provenance](https://docs.npmjs.com/generating-provenance-statements) (backed by [Sigstore](https://www.sigstore.dev/) and the [SLSA](https://slsa.dev/) framework). This gives you a publicly verifiable, cryptographic link between the code on npm and the exact source commit and workflow run that produced it — no manual `npm publish` from a local machine, ever.

| | |
|---|---|
| **Built and signed on** | ✅ GitHub Actions |
| **Source Commit** | [github.com/BloumeSAS/bloumechat-sdk@`<commit>`](https://github.com/BloumeSAS/bloumechat-sdk/commits/main) |
| **Build File** | [`.github/workflows/publish.yml`](.github/workflows/publish.yml) |
| **Public Ledger** | [Sigstore transparency log](https://search.sigstore.dev/) |

You can verify the provenance of any published version yourself:

```bash
npm view bloumechat --json | grep -A 10 attestations
```

Or check the **"Provenance"** panel directly on the [npm package page](https://www.npmjs.com/package/bloumechat) — it links to the exact commit, workflow file, and transparency log entry for every release.

---

## 🌟 Key Features
- **⚡ Real-time Communication**: Fully typed WebSocket events mapped intuitively (`messageCreate`, `memberAdd`, etc.).
- **🛠️ Comprehensive API Coverage**: Direct access and management of Guilds, Channels, Roles, Members, and Messages.
- **🖼️ Rich Embeds**: Native `EmbedBuilder` for creating visually stunning layouts.
- **🛡️ Full TypeScript Support**: Built for TS out of the box with extensive caching and `BigInt` bitwise permission handling.

---

## 📚 Complete SDK Documentation (A-Z)

This documentation explains every class, event, and method completely, with practical examples for each feature.

### 1. Configuration & Client

The core class is `BloumeChat`, which acts as the entry point and event emitter for your bot.

```typescript
import { BloumeChat } from "bloumechat";

const client = new BloumeChat();

// Login using your Bot Token provided at bloumechat.com/developers
client.login("YOUR_BOT_TOKEN");
```

---

### 2. Events List & Examples

The client continuously listens and triggers events you can hook into.

#### Example: Listening to Messages
```typescript
client.on("messageCreate", async (message) => {
  // Ignore messages from other bots
  if (message.author.isBot) return;

  if (message.content === "!ping") {
    // Reply directly to the message
    await message.reply("Pong! 🏓");
  }
});
```

#### Example: Welcoming a New Member
```typescript
client.on("memberAdd", async (data) => {
  const guild = client.guilds.cache.get(data.serverId);
  if (!guild) return;

  // Find the general channel and send a welcome message
  const generalChannel = guild.channels.cache.find(c => c.name === "general");
  if (generalChannel) {
    generalChannel.send(`Welcome to the server, <@${data.user.id}>! 🎉`);
  }
});
```

#### List of Available Events:
* `ready`: Connection to the WebSocket has been successfully established.
* `messageCreate (message: Message)`: Fired on a new message.
* `messageUpdate (message: Message)`: Fired when an existing message is edited.
* `messageDelete (data: { id: string })`: Fired when a message is deleted.
* `messageReactionAdd (data: Object)`: Fired when a reaction is added.
* `messageReactionRemoveAll (data: Object)`: Fired when all reactions are wiped.
* `memberAdd (data: Object)`: Fired when a user joins a server.
* `memberRemove (data: Object)`: Fired when a user leaves/is kicked.
* `memberUpdate (data: Object)`: Fired when member properties change (e.g., roles).
* `channelCreate (data: Object)`: Fired when a channel is created.
* `channelUpdate (data: Object)`: Fired when a channel is modified.
* `channelDelete (data: { id: string })`: Fired when a channel is destroyed.
* `presenceUpdate (data: Object)`: Fired when a user goes Online/Offline.
* `typingStart / typingStop (data: Object)`: Real-time typing indicators.

---

### 3. The `Message` Object

Whenever a message is sent in a channel, it is parsed into a `Message` object.

#### `message.reply(content, embeds?)`
Quickly replies in the same channel.
```typescript
await message.reply("Hello there!");

// With an embed
const embed = new EmbedBuilder().setTitle("Hi!");
await message.reply("Look at my embed:", [embed]);
```

#### `message.edit(content)`
Edits the text of the message (The bot must be the author).
```typescript
const replyMsg = await message.reply("Wait a second...");
await replyMsg.edit("Done! ✅");
```

#### `message.delete()`
Deletes the message permanently. Requires `MANAGE_MESSAGES` permission if the bot is not the author.
```typescript
if (message.content.includes("badword")) {
  await message.delete();
}
```

#### `message.react(emoji)`
Adds a unicode emoji reaction to the message. Requires `ADD_REACTION` permission.
```typescript
await message.react("👍");
await message.react("❤️");
```

#### `message.fetchReactions(emoji)`
Retrieves an array of users who clicked a specific emoji on the message.
```typescript
const usersWhoLiked = await message.fetchReactions("👍");
console.log(`${usersWhoLiked.length} people liked this!`);
```

#### `message.clearReactions()`
Removes ALL reactions from the message. Requires `MANAGE_MESSAGES` permission.
```typescript
await message.clearReactions();
```

#### `message.awaitReactions(options)`
Pauses the bot's execution to wait for users to react. Perfect for polls or interactive menus. Resolves when `max` clicks are received or `time` (ms) ends.
```typescript
await message.react("👍");
await message.react("👎");
await message.reply("Vote now! You have 10 seconds.");

// Wait 10 seconds for up to 50 reactions
const results = await message.awaitReactions({ max: 50, time: 10000 });

const thumbsUp = results.filter(r => r.emoji === "👍").length;
const thumbsDown = results.filter(r => r.emoji === "👎").length;

await message.reply(`Poll ended! 👍: ${thumbsUp} | 👎: ${thumbsDown}`);
```

#### `message.pin()` & `message.unpin()`
Pins or unpins the message to the channel. Requires `MANAGE_MESSAGES` permission.
```typescript
await message.pin();
```

---

### 4. The `Channel` Object

Extract the channel from a message (`message.channel`) or from the guild cache (`guild.channels.cache.get('ID')`).

#### `channel.send(content, embeds?)`
Sends a new message to the channel.
```typescript
await message.channel.send("Attention everyone!");
```

#### `channel.fetchMessages(options)`
Retrieves the history of the channel.
```typescript
// Fetch the last 50 messages
const history = await message.channel.fetchMessages({ limit: 50 });
history.forEach(msg => console.log(msg.content));
```

#### `channel.bulkDelete(messageIds)`
Deletes up to 100 messages at once. Requires `MANAGE_MESSAGES` permission.
```typescript
const msgs = await message.channel.fetchMessages({ limit: 10 });
const msgIds = msgs.map(m => m.id);

// Delete the 10 fetched messages instantly
await message.channel.bulkDelete(msgIds);
```

#### `channel.editPermissions(targetId, type, options)`
Sets explicit `allow` or `deny` overrides for specific roles or members on this channel, bypassing global server permissions.
```typescript
import { PermissionFlags } from "bloumechat";

// Prevent a specific role from sending messages in this channel
await message.channel.editPermissions(role.id, "ROLE", {
    allow: 0n,
    deny: PermissionFlags.SEND_MESSAGES
});
```

---

### 5. Guilds / Servers (`Guild.ts`)

Servers are managed by the `Guild` structure which orchestrates Channels, Roles, and Members. Accessible via `message.guild` or `client.guilds.cache.get('ID')`.

#### `guild.createChannel(options)`
Creates a new TEXT or VOICE channel. You can optionally make it private and set permission overwrites immediately. Requires `MANAGE_CHANNELS`.
```typescript
import { PermissionFlags } from "bloumechat";

// Create a private channel exclusively for 'VIP' roles
await message.guild.createChannel({
    name: "vip-lounge",
    type: "TEXT",
    isPrivate: true, // Hides from @everyone
    permissionOverwrites: [{
        id: vipRoleId,
        type: "ROLE",
        allow: PermissionFlags.VIEW_CHANNELS,
        deny: 0n
    }]
});
```

#### `guild.fetchCategories()` & `guild.createCategory(name)`
Retrieve all cached categories (and their nested channels) or create a new category visually grouping channels together. Requires `MANAGE_CHANNELS`.
```typescript
// Fetch existing categories
const categories = await message.guild.fetchCategories();
const ticketsCat = categories.find(c => c.name === "Tickets");

// Create a new category if it doesn't exist
if (!ticketsCat) {
    await message.guild.createCategory("Tickets");
}
```

#### `guild.createRole(options)`
Creates a new role with a specific `BigInt` permission bitmask. Requires `MANAGE_ROLES`.
```typescript
import { PermissionFlags } from "bloumechat";

const modRole = await message.guild.createRole({
    name: "Moderator",
    color: "#ff0000",
    hoist: true, // Display separately in member list
    permissions: PermissionFlags.VIEW_CHANNELS | PermissionFlags.SEND_MESSAGES | PermissionFlags.MANAGE_MESSAGES
});
```

#### `guild.editRole(roleId, options)` & `guild.deleteRole(roleId)`
Modifies or deletes an existing role. Requires `MANAGE_ROLES`.
```typescript
await message.guild.editRole(role.id, { name: "Senior Moderator", color: "#8b0000" });
await message.guild.deleteRole(role.id);
```

#### `guild.fetchBans()` & `guild.unbanMember(userId)`
Retrieve a list of banned members or revoke a user's ban. Requires `BAN_MEMBERS`.
```typescript
const bansList = await message.guild.fetchBans();
if (bansList.length > 0) {
    await message.guild.unbanMember(bansList[0].userId);
}
```

#### `guild.fetchInvites()` & `guild.createInvite(channelId, options)`
Get active server invites or generate a new one. Requires `CREATE_INVITE`.
```typescript
// Create an invite that expires in 1 hour (3600 seconds) and can only be used 5 times
const invite = await message.guild.createInvite(message.channel.id, {
    maxAge: 3600,
    maxUses: 5
});
await message.reply(`Here is your invite: https://bloumechat.com/invite/${invite.code}`);
```

---

### 6. Managing Permissions (`PermissionFlags`)

BloumeChat assigns authorities via bitwise math using `BigInt` natively supported by JavaScript. You do not need to memorize the values; the SDK exports them natively.

```typescript
import { PermissionFlags } from "bloumechat";

console.log(PermissionFlags.MANAGE_SERVER); // Access the server management flag
```

#### Combining Flags (Bitwise OR `|`)
To grant multiple permissions, combine them using the Bitwise OR `|` operator.
```typescript
const perms = PermissionFlags.VIEW_CHANNELS | PermissionFlags.SEND_MESSAGES | PermissionFlags.ADD_REACTION;
```

#### Checking Flags (Bitwise AND `&`)
To check if a bitmask contains a specific permission, use the Bitwise AND `&` operator. The SDK handles this internally for structures like `Role.hasPermission(flag)`.
```typescript
const isAdmin = (userPermissions & PermissionFlags.ADMINISTRATOR) === PermissionFlags.ADMINISTRATOR;
```

---

### 7. Rich Embeds (`EmbedBuilder`)

Easily construct rich display blocks mirroring user expectations. Embeds can contain titles, descriptions, colors, multiple fields, authors, and footers.

```typescript
import { EmbedBuilder } from "bloumechat";

const embed = new EmbedBuilder()
    .setTitle("✨ Server Diagnostics Card")
    .setDescription("Here is the current status of the requested systems.")
    .setColor("#00ff00") // Green banner
    .setAuthor({ name: "System Sentinel", iconUrl: "https://example.com/bot-icon.png" })
    .addFields(
      // Fields can be inline (side-by-side) or stacked
      { name: "CPU Load", value: "11%", inline: true },
      { name: "RAM Usage", value: "24GB / 64GB", inline: true },
      { name: "Network", value: "Stable", inline: false }
    )
    .setFooter({ text: "Diagnostics generated at" })
    .setTimestamp(); // Automatically adds the current date/time to the footer

// Send the embed alongside an optional message text
await message.reply("Diagnostics completed:", [embed]);
```

---

## 🧪 Testing & Continuous Integration

The SDK ships with a [Vitest](https://vitest.dev) unit test suite covering the client (token redaction, login validation, endpoint defaults), permission bitmask math, the `Collection` utility, `EmbedBuilder`, and the `Role` structure.

```bash
npm test            # run the full suite once
npm run test:watch  # watch mode
npm run test:coverage
```

Every push and pull request runs the [CI workflow](.github/workflows/ci.yml): type-checking, the full test suite across Node 20/22/24, a build, and a dependency audit, plus a coverage report uploaded as a build artifact.

Releases publish automatically and require no manual step: merging a commit to `main` that bumps `version` in `package.json` triggers the [publish workflow](.github/workflows/publish.yml), which re-runs type-checking, tests and the build, publishes to npm with provenance, then tags the commit and creates the matching GitHub Release. A manual GitHub Release (or `workflow_dispatch`) still works too, for one-off/hotfix publishes.

## 🤝 Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/BloumeSAS/bloumechat-sdk). Before opening a PR:

```bash
npm install
npm run lint   # type-check
npm test       # run the test suite
npm run build  # build dist/
```

## 📄 License

Released under the [ISC License](LICENSE).

---

<p align="center">
  <b>V1.4.1 - Developed with ❤️ for <a href="https://bloumechat.com">BloumeChat.com</a></b>
</p>
