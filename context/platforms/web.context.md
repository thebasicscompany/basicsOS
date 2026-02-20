# Web Portal Platform Context

## Overview

The Basics OS web portal is a Next.js 15 application (`apps/web`) providing the primary browser-based interface for company operations.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Runtime**: React 18 with server and client components
- **Data fetching**: tRPC v11 + TanStack Query v5
- **Styling**: Tailwind CSS v4 with semantic design tokens
- **Auth**: Better Auth v1 — session cookie, middleware-protected

## Structure

```
apps/web/src/
  app/
    (auth)/           # Unauthenticated routes (no layout)
      login/page.tsx
      register/page.tsx
      invite/[token]/page.tsx
    (dashboard)/      # Authenticated routes — shared sidebar layout
      layout.tsx      # Server component — renders NavClient + <main>
      NavClient.tsx   # Client component — active nav, user widget, sign-out
      page.tsx        # Dashboard home
      knowledge/page.tsx
      crm/page.tsx
      tasks/page.tsx
      meetings/page.tsx
      hub/page.tsx
      admin/team/page.tsx
    api/auth/         # Better Auth server handler
    layout.tsx        # Root HTML shell — renders <Toaster />
    globals.css       # Design tokens (@theme block)
  lib/
    trpc.ts           # tRPC React client — connects to NEXT_PUBLIC_API_URL/trpc
    auth-client.ts    # Better Auth browser client
  providers/
    TRPCProvider.tsx  # QueryClient + tRPC provider; credentials: "include"
    AuthProvider.tsx  # useAuth() hook — exposes { user, session }
  middleware.ts       # Route protection — redirects to /login if no session cookie
```

## Dashboard Layout Pattern

**Server layout → client nav child**:

```tsx
// layout.tsx (server) — renders NavClient + main
const DashboardLayout = ({ children }) => (
  <div className="flex h-screen bg-stone-50">
    <NavClient />
    <main className="flex-1 overflow-y-auto p-8">{children}</main>
  </div>
);

// NavClient.tsx (client) — uses usePathname, useAuth, useRouter
export const NavClient = (): JSX.Element => { ... };
```

`NavClient` renders `<Sidebar>` from `@basicsos/ui` and a user widget (initials avatar + sign-out button).

## Route Protection

`apps/web/src/middleware.ts` guards all routes except:

- `/login`, `/register`, `/invite/*` — always public
- `/api/*` — bypasses middleware

Requires `better-auth.session_token` cookie. Unauthenticated users are redirected to `/login`.

## Auth Usage in Components

```ts
// Read current user
const { user } = useAuth(); // from @/providers/AuthProvider

// Sign in / out
import { authClient } from "@/lib/auth-client";
await authClient.signIn.email({ email, password });
await authClient.signOut();
```

## tRPC in Client Components

```tsx
"use client";
import { trpc } from "@/lib/trpc";

const { data } = trpc.tasks.list.useQuery({});
const mutate = trpc.tasks.create.useMutation({ onSuccess: () => { ... } });
```

`credentials: "include"` on the HTTP link sends session cookies automatically — no manual auth header needed.

## Dialog + Form + Toast Pattern

All create/edit dialogs follow this structure:

```tsx
"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { addToast, Dialog, DialogContent, DialogHeader, DialogTitle,
         DialogTrigger, DialogFooter, Button, Input, Label } from "@basicsos/ui";

export const CreateFooDialog = ({ children, onCreated }): JSX.Element => {
  const [open, setOpen] = useState(false);
  const create = trpc.foo.create.useMutation({
    onSuccess: () => { addToast({ title: "Created!", variant: "success" }); setOpen(false); onCreated?.(); },
    onError: (err) => { addToast({ title: "Error", description: err.message, variant: "destructive" }); },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Foo</DialogTitle></DialogHeader>
        <form onSubmit={...}>
          {/* fields */}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
```

Existing dialog examples to copy from:

- `(dashboard)/tasks/CreateTaskDialog.tsx` — title + Select priority
- `(dashboard)/crm/CreateContactDialog.tsx` — contact fields
- `(dashboard)/crm/CreateDealDialog.tsx` — deal + stage Select
- `(dashboard)/hub/AddLinkDialog.tsx` — URL + label
- `(dashboard)/admin/team/InviteMemberDialog.tsx` — email + role

## UI Component Imports

All from `@basicsos/ui`:

```ts
import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Badge,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Separator,
  Toaster,
  addToast,
} from "@basicsos/ui";
```

## Design Tokens

Always use semantic tokens — never raw Tailwind color classes:

| Use             | Token class                  |
| --------------- | ---------------------------- |
| Primary actions | `bg-primary`, `text-primary` |
| Text on primary | `text-primary-foreground`    |
| Destructive     | `bg-destructive`             |
| Success         | `bg-success`                 |
| Warning         | `bg-warning`                 |

## "use client" Rules

- Add to any component using hooks (`useState`, `useEffect`, `useRouter`, tRPC)
- Radix-based components (`Dialog`, `Select`) already have it internally; consuming code must also add it
- Server-safe: `Card`, `Badge`, `Separator`, `Input` — no directive needed

## Admin Panel

`(dashboard)/admin/team/page.tsx` — fully implemented with member list and `InviteMemberDialog`. Access is currently UI-only (no role guard on the page itself — adminProcedure on the API enforces it).
