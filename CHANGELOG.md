# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.6.0] - 2026-07-05

### Added
- `guildCreate` event: fired when the bot is added to a new server, via a new `server:joined` socket event — the `Guild` is already in `client.guilds.cache` by the time the listener runs. Previously there was no way for a bot to react to being added to a server in real time.

### Fixed
- **`client.members.cache` was never actually updated on member join/leave/kick/ban.** `guildMemberAdd`/`guildMemberRemove` were re-emitted from the socket payload as-is without touching the cache, so `client.members.cache` silently went stale the moment any member joined or left. `GatewayManager` now constructs/caches a real `Member` on `server:member_add` and removes the matching cached entry (matched by the underlying user's publicId, since the removal payloads don't carry the member row's own id) on `server:member_remove`/`server:member_removed`. `guildMemberAdd` now emits the `Member` instance instead of the raw payload.
- **`Message#fetchReactions()` returned the raw nested API response instead of the flat `ReactionUserDTO[]` its own type signature promised**, silently breaking at runtime for any consumer that trusted the types (e.g. `reactions[0].userName` was `undefined`). It now correctly filters to the requested emoji's group and flattens `users` to `{ userPublicId, userName, userImage }`.
- **`ChannelManager.fetch()` / `UserManager.fetch()` were unusable** — `GET /channels/:id` and `GET /users/:id` were never implemented on the BloumeChat API, so both calls resolved against the platform's HTML 404 page instead of JSON. Added the missing routes server-side; both methods now work as documented.

### Removed
- The platform no longer auto-posts a `"**{app}** a rejoint le serveur !"` system message when a bot is added via OAuth2 — this was unsolicited and not something a bot author could opt out of. Use the new `guildCreate` event if you want a bot-authored welcome message instead.

## [1.5.0] - 2026-07-05

### Added
- `errors/`: `BloumeChatError` (base), `BloumeChatAPIError`, `RateLimitError`, `BloumeChatAuthError`, `BloumeChatTimeoutError` — typed errors instead of generic `Error` throws, so consumers can `instanceof`-check failure modes.
- `guild.invites` (`InviteManager`), `guild.emojis` (`EmojiManager`), `channel.webhooks` (`WebhookManager`) — cached managers following the existing `RoleManager` pattern. `EmojiManager` also adds emoji creation, which wasn't previously exposed.
- Per-route rate-limit buckets in the REST layer: a 429 on one resource (e.g. a busy channel) no longer delays requests to unrelated resources.
- Vitest test suite (76 tests) covering the client, REST layer (including the new rate-limit buckets), gateway wiring, permissions, `Collection`, `EmbedBuilder`, `Role`, `Member`, `Channel`, and the three new managers.
- ESLint + Prettier, wired into CI.
- `CONTRIBUTING.md`, `SECURITY.md`, GitHub issue/PR templates, Dependabot config.
- CI/CD: automatic npm publishing (with [provenance](https://docs.npmjs.com/generating-provenance-statements)) on a version bump to `main`, GitHub Release + git tag created automatically.

### Changed
- Split the 680-line monolithic `bloumechat.ts` into `rest/RestManager.ts` (REST traffic), `gateway/GatewayManager.ts` (WebSocket event dispatch), and `types.ts` (shared interfaces). Public API unchanged.
- Every method that returned `any`/`any[]` now returns a precise type (`structures/dto.ts`), derived from the actual API response shapes.
- `Channel.fetchMessages()` / `search()` / `fetchPins()` and `BloumeChat.searchMessages()` now wrap results in `Message` instances (previously raw JSON), matching the rest of the SDK.
- Replaced every lazy `require()` (used to dodge circular imports) with real static imports — traced through the actual dependency graph so `Guild`/`Channel`/etc. only need to be imported as *types* in most places, breaking the runtime cycle entirely.
- Minimum supported Node version raised to 20 (Node 18 is EOL and incompatible with the test tooling).
- `tsconfig.json`: added `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noUncheckedIndexedAccess`.
- `package.json`: added `sideEffects: false`, `exports` map, `repository`/`homepage`/`bugs`/`engines`.

### Fixed
- `Guild.fetchInvites()` called the invites endpoint without `?all=true`, which returns only the caller's own invite rather than the server-wide list the method is documented (and expected) to return — it silently always resolved to `[]`.
- `toJSON()`/`console.log()` on a `BloumeChat` client threw `TypeError: Converting circular structure to JSON` as soon as any manager had cached data, because the redaction shortcut spread `this` directly, keeping circular `structure.client === this` references intact.
- `GuildManager.fetchAll()` fetched each guild's own member twice per guild (once into an unused variable, then again via `MemberManager.fetch()`) on every login/guild fetch.
- `Role.ts` imported `Guild` and `ALL_PERMISSIONS` without using either.

## [1.4.2] - 2026-07-04

### Changed
- Trimmed the README's full A-Z API reference (Message/Channel/Guild/Permissions/EmbedBuilder sections) down to a single login + `messageCreate` quickstart example, linking to [dev.bloume.chat](https://dev.bloume.chat) for the full API reference instead of duplicating it.

## [1.4.1] - 2026-07-04

### Added
- `.gitignore`, `LICENSE` (ISC), professional CI/CD workflows (typecheck/build matrix, automatic npm publishing with provenance on a version bump).
- README: npm version/downloads/CI/provenance badges, a Provenance & Supply Chain Security section.
- README footer version now auto-syncs with `package.json` via an `npm version` lifecycle script, checked in CI so the two can't silently drift.

## [1.4.0] and earlier

Released between **2026-02-18** (`1.0.0`) and **2026-07-02** (`1.4.0`) — this CHANGELOG was introduced in `1.4.1`, so detailed per-version notes for this range aren't available. For reference, the versions published to npm in this range: `1.0.0`–`1.0.20`, `1.1.0`, `1.2.0`–`1.2.4`, `1.3.0`, `1.4.0`. See the npm package page's version history for exact publish dates.
