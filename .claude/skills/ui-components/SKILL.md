# Skill: ui-components

Add a new component to `packages/ui` using the Radix + CVA pattern.

## Steps

### 1. Install Radix dep (if needed)

```bash
bun --filter @basicsos/ui add @radix-ui/react-[name]
```

### 2. Create the component file

```tsx
// packages/ui/src/components/MyComponent.tsx
"use client"; // only if interactive (uses hooks, browser events, Radix)

import { forwardRef } from "react";
import * as MyPrimitive from "@radix-ui/react-[name]";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils.js";

const myVariants = cva("base-classes", {
  variants: {
    variant: {
      default: "...",
      destructive: "...",
    },
    size: {
      default: "...",
      sm: "...",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

interface MyComponentProps
  extends
    React.ComponentPropsWithoutRef<typeof MyPrimitive.Root>,
    VariantProps<typeof myVariants> {}

export const MyComponent = forwardRef<React.ElementRef<typeof MyPrimitive.Root>, MyComponentProps>(
  ({ className, variant, size, ...props }, ref) => (
    <MyPrimitive.Root
      ref={ref}
      className={cn(myVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
MyComponent.displayName = MyPrimitive.Root.displayName;
```

### 3. Export from index.ts

```ts
// packages/ui/src/index.ts
export { MyComponent } from "./components/MyComponent.js";
```

### 4. Build

```bash
bun --filter @basicsos/ui build
```

### 5. Import in consuming app

```tsx
import { MyComponent } from "@basicsos/ui";
```

## Design token classes to use

| Purpose        | Class                                        |
| -------------- | -------------------------------------------- |
| Primary action | `bg-primary text-primary-foreground`         |
| Error / delete | `bg-destructive text-destructive-foreground` |
| Success        | `bg-success text-success-foreground`         |
| Warning        | `bg-warning text-warning-foreground`         |
| Border         | `border-border` or `border-gray-200`         |
| Muted text     | `text-muted-foreground`                      |
| Background     | `bg-background`                              |

**Never use raw color values like `bg-indigo-600` or `bg-blue-500` — use semantic tokens.**

## Rules

- Named exports only (no `export default`)
- No `any` — use generics or `unknown` with type guards
- Use `forwardRef` for elements that accept a `ref`
- Add `"use client"` for Radix primitives and hooks
- Use `cn()` for className merging (from `../lib/utils.js`)
