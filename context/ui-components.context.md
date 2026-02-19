# UI Components — Context

All reusable components live in `packages/ui/src/components/`. Import from `@basicsos/ui`.

## Available Components

| Component | File | Type | Description |
|-----------|------|------|-------------|
| `Button` | `Button.tsx` | client | CVA variants: `default \| destructive \| outline \| ghost \| link`; sizes: `default \| sm \| lg \| icon` |
| `Input` | `Input.tsx` | server | Forwarded ref text input; `border-primary` focus ring |
| `Label` | `Label.tsx` | server | Form label (Radix Label) |
| `Card` + parts | `Card.tsx` | server | `Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter` |
| `Badge` | `Badge.tsx` | server | CVA variants: `default \| secondary \| destructive \| outline \| success \| warning` |
| `Dialog` + parts | `Dialog.tsx` | client | `Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription` |
| `Select` + parts | `Select.tsx` | client | `Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator` |
| `Avatar` + parts | `Avatar.tsx` | client | `Avatar, AvatarImage, AvatarFallback` |
| `Separator` | `Separator.tsx` | server | Radix Separator |
| `EmptyState` | `EmptyState.tsx` | server | `Icon` + `heading` + `description` + optional `action` slot; accepts `className`, `iconClassName` |
| `Toaster` | `Toaster.tsx` | client | Render once in root layout |
| `Toast` + parts | `Toast.tsx` | client | Low-level primitives (prefer `addToast` instead) |
| `Sidebar` | `Sidebar.tsx` | client | Navigation sidebar; accepts `items: SidebarItem[]`, `activeHref`, `width`, `header`, `footer` |

## Design Tokens

Single source of truth for the design language:

- **Web/Desktop**: `packages/ui/src/tokens.css` — imported by both apps
- **Mobile**: `apps/mobile/lib/tokens.ts` — mirrored constants for React Native

Key colors use the **warm stone palette** (not cold gray). Brand: `#6366f1` (indigo).

## Lucide Icon Re-exports

All icons are re-exported from `packages/ui/src/index.ts` for consistent usage:

```ts
import { Sparkles, BookOpen, Users, CheckSquare, Video, Link2, Plus, Search, Loader2 } from "@basicsos/ui";
```

Common icon mappings:
- `Sparkles` — AI features
- `BookOpen` — knowledge base
- `Users` — CRM / team
- `CheckSquare` — tasks
- `Video` — meetings
- `Link2` — hub / links
- `MessageSquare` — chat / transcript
- `Loader2` — loading spinners (animate with `animate-spin`)

## className Customization

Every component accepts a `className` prop merged via `cn()`:

```tsx
import { cn } from "@basicsos/ui";

// In component definition:
<div className={cn("default-classes", className)} />
```

Component-specific customization:
- **Sidebar**: `width` prop, `header`/`footer` slot props
- **EmptyState**: `className` for container, `iconClassName` for icon color
- **Button**: extend via CVA — add new variants to `buttonVariants`
- **Card**: compose with `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`

## Toast API

Trigger toasts imperatively (no hook needed):

```ts
import { addToast, dismissToast } from "@basicsos/ui";

addToast({ title: "Saved!", variant: "success" });
addToast({ title: "Error", description: err.message, variant: "destructive" });
```

`<Toaster />` must be rendered once in `apps/web/src/app/layout.tsx`.

## Design Language Rules

1. **Stone, not gray** — never use `gray-*` Tailwind classes; always use `stone-*`
2. **Semantic tokens first** — prefer `bg-primary`, `text-foreground`, `border-border` over raw colors
3. **Lucide, not emoji** — never use emoji as icons; always use Lucide components
4. **Components, not raw HTML** — use `<Card>` not `<div className="border bg-white">`, use `<Button>` not `<button>`, use `<Input>`/`<Label>` not `<input>`/`<label>`, use `<EmptyState>` not inline empty messages
5. **Badge for status** — use `<Badge variant="...">` not inline pill divs
6. **Dialog for modals** — use `<Dialog>` not custom modal divs

### Color Reference (stone palette)

| Class | Use |
|-------|-----|
| `text-stone-900` | Primary text |
| `text-stone-700` | Section headings |
| `text-stone-500` | Secondary text |
| `text-stone-400` | Placeholder, timestamps |
| `border-stone-200` | Default borders |
| `border-stone-300` | Strong borders |
| `bg-stone-100` | Subtle backgrounds |
| `bg-stone-50` | App background, muted inputs |

## Adding a New Component

1. Install Radix dep in `packages/ui/package.json` if needed
2. Create `packages/ui/src/components/MyComponent.tsx` (add `"use client"` if it uses hooks/events)
3. Export from `packages/ui/src/index.ts`
4. Run `pnpm --filter @basicsos/ui build`

## Existing Feature Components (for reference / copy)

These live co-located with their feature pages in `apps/web/src/app/(dashboard)/`:

| Component | Location |
|-----------|----------|
| `CreateTaskDialog` | `tasks/CreateTaskDialog.tsx` |
| `KanbanColumn` | `tasks/KanbanColumn.tsx` |
| `TaskCard` | `tasks/TaskCard.tsx` |
| `CreateContactDialog` | `crm/CreateContactDialog.tsx` |
| `CreateDealDialog` | `crm/CreateDealDialog.tsx` |
| `DealCard` | `crm/DealCard.tsx` |
| `AddLinkDialog` | `hub/AddLinkDialog.tsx` |
| `InviteMemberDialog` | `admin/team/InviteMemberDialog.tsx` |
| `SummaryCard` | `meetings/[id]/SummaryCard.tsx` |
| `TranscriptDisplay` | `meetings/[id]/TranscriptDisplay.tsx` |
| `NavClient` | `NavClient.tsx` (dashboard sidebar + user widget) |

These are **not** in `@basicsos/ui` — they are feature-specific and import from it. Use them as reference implementations for new dialogs.
