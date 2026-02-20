# Skill: standardize-ui

Iterative workflow for designing a UI component and standardizing its usage across all apps.

## When to Use

Run this when you want to:
- Add a new component to `packages/ui/` and adopt it everywhere
- Audit existing inline patterns and replace them with shared components
- Ensure consistent UI across web, desktop overlay, and mobile

## Steps

### 1. Design or update the component

Create/update the component in `packages/ui/src/components/`:

```bash
# Check existing components
ls packages/ui/src/components/

# Reference pattern: Button.tsx (CVA + forwardRef + cn)
cat packages/ui/src/components/Button.tsx
```

Follow the [ui-components skill](/.claude/skills/ui-components/SKILL.md) for the component creation pattern.

### 2. Export and build

```ts
// packages/ui/src/index.ts — add export
export { MyComponent } from "./components/MyComponent.js";
```

```bash
bun --filter @basicsos/ui build
```

### 3. Preview in one location

Pick a single page and replace the inline pattern with the shared component. Verify it looks and works correctly.

### 4. Audit all usages

Use grep to find all inline patterns that should use this component:

```bash
# Textarea
rg '<textarea' apps/ --files-with-matches

# Button (raw buttons with styling)
rg '<button[^>]*className="[^"]*bg-primary' apps/ --files-with-matches

# PageHeader
rg 'text-2xl font-bold text-stone-900' apps/ --files-with-matches

# Switch
rg 'role="switch"' apps/ --files-with-matches

# Tabs
rg 'activeTab\|setActiveTab\|selectedTab' apps/ --files-with-matches

# Kbd
rg '<kbd' apps/ --files-with-matches

# Direct icon imports (should be from @basicsos/ui)
rg 'from "lucide-react"' apps/ --files-with-matches
```

### 5. Replace everywhere

For each file:
1. Add the component to the `@basicsos/ui` import
2. Replace the inline pattern
3. Remove unused imports

**Component-to-variant mapping:**

| Inline pattern | Replace with |
|---|---|
| `<button className="...bg-primary text-white...">` | `<Button>` |
| `<button className="...border...bg-white...">` | `<Button variant="outline">` |
| `<button className="...hover:bg-stone-100...">` | `<Button variant="ghost">` |
| `<button className="...text-primary hover:underline...">` | `<Button variant="link">` |
| Icon-only `<button>` with fixed width/height | `<Button size="icon">` |
| `<textarea className="...">` | `<Textarea className="...">` |
| `<h1 className="text-2xl font-bold text-stone-900">Title</h1>` | `<PageHeader title="Title">` |
| `<h1>` + `<p className="...text-stone-500">desc</p>` | `<PageHeader title="..." description="...">` |
| Header + action button side by side | `<PageHeader title="..." action={<Button>New</Button>}>` |
| Hand-rolled toggle switch | `<Switch checked={...} onCheckedChange={...}>` |
| Inline tab buttons with active state | `<Tabs>` + `<TabsList>` + `<TabsTrigger>` + `<TabsContent>` |
| `<kbd className="...">` | `<Kbd>` |

### 6. Verify

```bash
bun --filter @basicsos/ui build
bun --filter @basicsos/web build
bun --filter @basicsos/desktop build
bun test
```

## Available Components

| Component | File | Interactive? |
|---|---|---|
| Button | `Button.tsx` | Yes (`"use client"`) |
| Input | `Input.tsx` | No |
| Textarea | `Textarea.tsx` | No |
| Label | `Label.tsx` | Yes |
| Card (+ Header, Title, etc.) | `Card.tsx` | No |
| Badge | `Badge.tsx` | No |
| Dialog (+ Trigger, Content, etc.) | `Dialog.tsx` | Yes |
| Select (+ Trigger, Content, etc.) | `Select.tsx` | Yes |
| Tabs (+ List, Trigger, Content) | `Tabs.tsx` | Yes |
| Switch | `Switch.tsx` | Yes |
| DropdownMenu (+ Trigger, Content, etc.) | `DropdownMenu.tsx` | Yes |
| Tooltip (+ Trigger, Content, Provider) | `Tooltip.tsx` | Yes |
| Avatar (+ Image, Fallback) | `Avatar.tsx` | No |
| Separator | `Separator.tsx` | No |
| EmptyState | `EmptyState.tsx` | No |
| PageHeader | `PageHeader.tsx` | No |
| Kbd | `Kbd.tsx` | No |
| Toast / Toaster | `Toast.tsx` / `Toaster.tsx` | Yes |
| Sidebar | `Sidebar.tsx` | Yes |

## Tips

- Always import icons from `@basicsos/ui` (not `lucide-react`)
- Use `cn()` from `@basicsos/ui` for className merging
- Keep overlay-specific styles (vibrancy, transparency) — don't replace those
- Auth pages (login/register) have different header patterns — skip PageHeader there
- When in doubt, run the `ui-standardizer` agent for automated auditing
