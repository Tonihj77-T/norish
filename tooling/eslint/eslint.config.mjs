/**
 * Norish ESLint Configuration
 *
 * Centralized ESLint configuration for the project using ESLint v9 flat config.
 * Uses TypeScript, React, Next.js, JSX-A11y, Prettier, and unused-imports plugins.
 */

import { defineConfig, globalIgnores } from "eslint/config";
import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import _import from "eslint-plugin-import";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import jsxA11Y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-plugin-prettier";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FlatCompat needs baseDirectory to be the project root for proper resolution
const projectRoot = path.resolve(__dirname, "../..");

const compat = new FlatCompat({
  baseDirectory: projectRoot,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

/**
 * Global patterns to ignore during linting
 */
const ignorePatterns = [
  ".now/*",
  "**/*.css",
  "**/.changeset",
  "**/dist",
  "**/dist-server",
  "esm/*",
  "public/*",
  "tests/*",
  "scripts/*",
  "**/*.config.js",
  "**/.DS_Store",
  "**/node_modules",
  "**/coverage",
  "**/.next",
  "**/build",
  "lib/logger.ts", // Client logger uses console internally by design
  "!**/.commitlintrc.cjs",
  "!**/.lintstagedrc.cjs",
  "!**/jest.config.js",
  "!**/plopfile.js",
  "!**/react-shim.js",
  "!**/tsup.config.ts",
];

/**
 * ESLint rules configuration
 */
const rules = {
  "no-console": "warn",
  "react/prop-types": "off",
  "react/jsx-uses-react": "off",
  "react/react-in-jsx-scope": "off",
  "react-hooks/exhaustive-deps": "off",
  "jsx-a11y/click-events-have-key-events": "warn",
  "jsx-a11y/interactive-supports-focus": "warn",
  "prettier/prettier": "warn",
  "no-unused-vars": "off",
  "unused-imports/no-unused-vars": "off",
  "unused-imports/no-unused-imports": "warn",

  "@typescript-eslint/no-unused-vars": [
    "warn",
    {
      args: "after-used",
      ignoreRestSiblings: false,
      argsIgnorePattern: "^_.*?$",
      varsIgnorePattern: "^_.*?$",
      caughtErrorsIgnorePattern: "^_.*?$",
    },
  ],

  "import/order": [
    "warn",
    {
      groups: ["type", "builtin", "object", "external", "internal", "parent", "sibling", "index"],

      pathGroups: [
        {
          pattern: "~/**",
          group: "external",
          position: "after",
        },
      ],

      "newlines-between": "always",
    },
  ],

  "react/self-closing-comp": "warn",

  "react/jsx-sort-props": [
    "warn",
    {
      callbacksLast: true,
      shorthandFirst: true,
      noSortAlphabetically: false,
      reservedFirst: true,
    },
  ],

  "padding-line-between-statements": [
    "warn",
    {
      blankLine: "always",
      prev: "*",
      next: "return",
    },
    {
      blankLine: "always",
      prev: ["const", "let", "var"],
      next: "*",
    },
    {
      blankLine: "any",
      prev: ["const", "let", "var"],
      next: ["const", "let", "var"],
    },
  ],
};

export default defineConfig([
  globalIgnores(ignorePatterns),

  // React, JSX-A11y, Prettier configs via FlatCompat (excluding Next.js which has its own flat config)
  ...fixupConfigRules(
    compat.extends(
      "plugin:react/recommended",
      "plugin:prettier/recommended",
      "plugin:jsx-a11y/recommended"
    )
  ).map((config) => ({
    ...config,
    settings: {
      ...config.settings,
      react: {
        version: "detect",
      },
    },
  })),

  // Main TypeScript/React config
  {
    plugins: {
      react: fixupPluginRules(react),
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
      import: fixupPluginRules(_import),
      "@typescript-eslint": typescriptEslint,
      "jsx-a11y": fixupPluginRules(jsxA11Y),
      prettier: fixupPluginRules(prettier),
    },

    languageOptions: {
      globals: {
        ...Object.fromEntries(Object.entries(globals.browser).map(([key]) => [key, "off"])),
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: 12,
      sourceType: "module",

      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    settings: {
      react: {
        version: "detect",
      },
    },

    files: ["**/*.ts", "**/*.tsx"],

    rules: {
      ...rules,
      // React hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]);
