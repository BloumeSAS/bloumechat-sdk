// @ts-check
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const eslintConfigPrettier = require("eslint-config-prettier");
const globals = require("globals");

module.exports = tseslint.config(
    { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            globals: { ...globals.node },
        },
        rules: {
            // The SDK deliberately types some payloads as `any` at the socket/REST
            // boundary (raw server JSON) before wrapping them in typed structures —
            // matches the existing codebase style rather than fighting it everywhere.
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "no-constant-condition": ["error", { checkLoops: false }],
            // `export declare interface BloumeChat { on(...): this }` is the standard,
            // intentional pattern for typing an EventEmitter subclass's event map —
            // not an accidental unsafe merge.
            "@typescript-eslint/no-unsafe-declaration-merging": "off",
        },
    },
    {
        // Plain CommonJS config/tooling files — `require()` is the correct style here,
        // not a stand-in for a circular-import workaround (all of those were removed
        // from the TS source in favor of real static imports).
        files: ["eslint.config.js", "scripts/**/*.js"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        },
    },
    eslintConfigPrettier
);
