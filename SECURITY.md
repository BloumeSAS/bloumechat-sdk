# Security Policy

## Supported Versions

Only the latest published version on npm is supported. Since releases publish automatically on every version bump (see [publish.yml](.github/workflows/publish.yml)), staying current is just `npm update bloumechat`.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, report it privately:

- Email: **security@bloume.fr**
- Or use [GitHub's private vulnerability reporting](https://github.com/BloumeSAS/bloumechat-sdk/security/advisories/new) on this repository.

Please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce (a minimal code sample if possible).
- Which version(s) of the SDK are affected.

### What to expect

- **Acknowledgement** within 72 hours.
- We'll work with you to understand and confirm the issue, then prepare a fix.
- A patched version will be published to npm, and a GitHub Security Advisory will be published crediting you (unless you prefer to remain anonymous), once a fix is available.

## Scope

This policy covers the `bloumechat` npm package (this repository). For vulnerabilities in the BloumeChat platform itself (the API, the web/desktop/mobile apps), please contact **security@bloume.fr** directly rather than filing them here.
