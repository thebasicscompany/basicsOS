---
paths: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
---
# Code Style Rules

- Use named exports exclusively — no default exports
- TypeScript strict mode — no `any` types, no type assertions unless unavoidable
- Use `const` by default, `let` only when reassignment is needed, never `var`
- Prefer arrow functions for callbacks, named functions for top-level declarations
- Use template literals over string concatenation
- Destructure objects and arrays when accessing multiple properties
- Keep functions under 40 lines — extract helpers if longer
- Use early returns to reduce nesting
