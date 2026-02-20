/** @type {import("eslint").Linter.Config} */
const config = {
  root: true,
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  plugins: ["@typescript-eslint"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    project: false, // Don't require tsconfig for faster linting
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Less strict rules - warnings instead of errors
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/ban-ts-comment": "warn",
    "no-console": "off", // Allow console.log for now
    "prefer-const": "warn",
    "no-var": "warn",
  },
  ignorePatterns: ["dist", "node_modules", "*.config.js", "*.config.ts"],
};

module.exports = config;
