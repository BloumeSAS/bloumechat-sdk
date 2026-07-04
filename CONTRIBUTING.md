# Contributing to bloumechat

Thanks for considering a contribution! This SDK is used by real bots in production, so the bar is: **don't break the public API, keep it tested, keep it typed.**

## Getting set up

```bash
git clone https://github.com/BloumeSAS/bloumechat-sdk.git
cd bloumechat-sdk
npm install
```

## Before opening a PR

Run the full local check suite — the same one CI runs:

```bash
npm run typecheck    # tsc --noEmit
npm run lint          # ESLint
npm run format:check  # Prettier (run `npm run format` to auto-fix)
npm test              # Vitest
npm run build         # tsup — confirms the package actually builds
```

## Guidelines

- **No breaking changes without discussion.** If your change alters an existing method's signature or behavior, open an issue first so we can agree on a major-version bump and a migration note.
- **Add tests for new behavior.** A bug fix should come with a regression test; a new method should come with at least a happy-path test. See `test/` for the existing patterns (mocked `apiCall`/`fetch`, no real network calls).
- **Match the existing style.** 4-space indent, double quotes — Prettier enforces this automatically, just run `npm run format` before committing.
- **Typed over `any`.** If you're touching a method that returns `any`/`any[]`, prefer adding a proper interface in `structures/dto.ts` (see existing entries for the pattern) instead of leaving it untyped.
- **Errors:** throw one of the classes in `errors/` (or add a new one there) instead of a bare `new Error(...)`, so consumers can `instanceof`-check failure modes.

## Commit messages

No strict format required, but explain the *why* — a one-line summary plus a short paragraph of context is more useful than a perfect Conventional Commits header.

## Releasing (maintainers)

Releases are automatic: bump `version` in `package.json` (e.g. `npm version patch`), push to `main`, and the [publish workflow](.github/workflows/publish.yml) tests, builds, publishes to npm with provenance, tags the commit, and creates the GitHub Release — no manual `npm publish` needed.
