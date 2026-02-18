import type { NodePlopAPI } from "plop";

// Plop requires a default export — framework exception to named-export rule.
const plopConfig = (plop: NodePlopAPI): void => {
  plop.setGenerator("module", {
    description: "Generate a new Basics OS module",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Module name (lowercase, hyphenated, e.g. inventory):",
        validate: (input: string) =>
          /^[a-z][a-z0-9-]*$/.test(input) ||
          "Use lowercase letters, numbers, and hyphens only",
      },
      {
        type: "input",
        name: "displayName",
        message: "Display name (e.g. Inventory):",
      },
      {
        type: "input",
        name: "description",
        message: "Module description:",
      },
      {
        type: "input",
        name: "icon",
        message: "Icon (emoji, e.g. 📦):",
        default: "📦",
      },
    ],
    actions: [
      {
        type: "add",
        path: "packages/db/src/schema/{{name}}.ts",
        templateFile: "plop-templates/schema.ts.hbs",
      },
      {
        type: "add",
        path: "packages/shared/src/validators/{{name}}.ts",
        templateFile: "plop-templates/validator.ts.hbs",
      },
      {
        type: "add",
        path: "packages/api/src/routers/{{name}}.ts",
        templateFile: "plop-templates/router.ts.hbs",
      },
      {
        type: "add",
        path: "context/modules/{{name}}.context.md",
        templateFile: "plop-templates/context.md.hbs",
      },
      {
        type: "modify",
        path: "packages/shared/src/validators/index.ts",
        pattern: /(export \* from ".\/automations.js";)/,
        template: '$1\nexport * from "./{{name}}.js";',
      },
    ],
  });
};

export default plopConfig;
