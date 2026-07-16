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

## ✍️ Example

```typescript
import { BloumeChat } from "bloumechat";

const client = new BloumeChat();

client.on("ready", () => console.log(`Logged in as ${client.user?.username}`));

client.on("messageCreate", async (message) => {
  if (message.author.isBot) return;

  if (message.content === "!ping") {
    await message.reply("Pong! 🏓");
  }
});

// Login using your Bot Token provided at bloumechat.com/developers
client.login("YOUR_BOT_TOKEN");
```

📖 Full API reference and guides: **[dev.bloume.chat](https://dev.bloume.chat)**

---

## 🧪 Testing & Continuous Integration

The SDK ships with a [Vitest](https://vitest.dev) unit test suite covering the client (token redaction, login validation, endpoint defaults), permission bitmask math, the `Collection` utility, `EmbedBuilder`, and the `Role` structure.

```bash
npm test            # run the full suite once
npm run test:watch  # watch mode
npm run test:coverage
```

Every push and pull request runs the [CI workflow](.github/workflows/ci.yml): type-checking, ESLint, a Prettier format check, the full test suite across Node 20/22/24, a build, and a dependency audit, plus a coverage report uploaded as a build artifact.

Releases publish automatically and require no manual step: merging a commit to `main` that bumps `version` in `package.json` triggers the [publish workflow](.github/workflows/publish.yml), which re-runs type-checking, lint, tests and the build, publishes to npm with provenance, then tags the commit and creates the matching GitHub Release. A manual GitHub Release (or `workflow_dispatch`) still works too, for one-off/hotfix publishes.

## 🤝 Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/BloumeSAS/bloumechat-sdk) — see [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide. Quick version:

```bash
npm install
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run format:check # Prettier
npm test             # run the test suite
npm run build        # build dist/
```

`npm run lint:fix` and `npm run format` will auto-fix most lint/formatting issues.

Found a security issue? Please follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## 📄 License

Released under the [ISC License](LICENSE).

---

<p align="center">
  <b>V2.1.0 - Developed with ❤️ for <a href="https://bloumechat.com">BloumeChat.com</a></b>
</p>
