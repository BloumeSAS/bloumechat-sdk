#!/usr/bin/env node
/**
 * Keeps the "Vx.y.z" footer in README.md in sync with package.json's version.
 * Runs automatically on `npm version <bump>` (see the "version" lifecycle
 * script in package.json) and is also checked (not fixed) in CI so a README
 * edited without bumping the version — or vice versa — fails the build
 * instead of silently drifting.
 */
const fs = require("fs");
const path = require("path");

const README_PATH = path.join(__dirname, "..", "README.md");
const { version } = require("../package.json");

const VERSION_LINE = /(<b>)V\d+\.\d+\.\d+( - Developed with)/;

const readme = fs.readFileSync(README_PATH, "utf8");

if (!VERSION_LINE.test(readme)) {
    console.error(`[sync-readme-version] Could not find the version footer line in ${README_PATH}.`);
    process.exit(1);
}

const updated = readme.replace(VERSION_LINE, `$1V${version}$2`);

if (updated === readme) {
    console.log(`[sync-readme-version] README already up to date (v${version}).`);
    process.exit(0);
}

if (process.argv.includes("--check")) {
    console.error(`[sync-readme-version] README footer is out of sync with package.json (v${version}). Run "node scripts/sync-readme-version.js" and commit the result.`);
    process.exit(1);
}

fs.writeFileSync(README_PATH, updated);
console.log(`[sync-readme-version] README footer updated to v${version}.`);
