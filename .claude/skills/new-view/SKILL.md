# Skill: Create a New UI View

## When to Use

Adding a new page or component to the web portal.

## Next.js App Router Page

```ts
// apps/web/src/app/(dashboard)/my-module/page.tsx
import { db } from "@basicsos/db";
import { myTable } from "@basicsos/db";

// Server component — fetches data directly, no loading state needed
const MyModulePage = async (): Promise<JSX.Element> => {
  let rows: Array<{ id: string; name: string }> = [];
  try {
    rows = await db.select({ id: myTable.id, name: myTable.name }).from(myTable);
  } catch {
    // DB not available (e.g. dev without docker) — show empty state
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">My Module</h1>
        <Button><Plus size={14} className="mr-1" /> New Item</Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState Icon={Package} heading="No items yet" description="Create your first item." />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-lg border bg-white p-4">
              {row.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Next.js App Router requires default export for page segments.
export default MyModulePage;
```

## Add to Sidebar Navigation

Edit `apps/web/src/app/(dashboard)/NavClient.tsx` — add an entry to the `NAV_ITEMS` array:

```ts
import { Wrench } from "lucide-react";

// In NAV_ITEMS: SidebarItem[]
{ label: "My Module", href: "/my-module", icon: Wrench },
```

## Client Component (needs interactivity)

```ts
"use client";

import { useState } from "react";

// Use "use client" directive only for components that need:
// - Event handlers (onClick, onChange, onSubmit)
// - React hooks (useState, useEffect, useCallback)
// - Browser APIs (localStorage, window)

const MyForm = (): JSX.Element => {
  const [name, setName] = useState("");
  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    // call tRPC mutation or server action
  };
  return <form onSubmit={handleSubmit}>...</form>;
};

export { MyForm };
```

## tRPC on the Client

```ts
"use client";
import { trpc } from "@/lib/trpc";

const MyClientComponent = (): JSX.Element => {
  const { data, isLoading } = trpc.myModule.list.useQuery({});
  const createMutation = trpc.myModule.create.useMutation();

  return (
    <Button onClick={() => createMutation.mutate({ name: "New Item" })}>
      {isLoading ? "Loading..." : "Add"}
    </Button>
  );
};
```

## File Naming Rules

- Route groups `(dashboard)`, `(auth)` don't add to URL path
- `page.tsx` → default export required (Next.js)
- `layout.tsx` → default export required (Next.js)
- All other files → named exports only

## Checklist

- [ ] Page created at correct route path
- [ ] Default export used (Next.js requirement)
- [ ] Data fetched from DB (server component) or via tRPC (client component)
- [ ] Empty state shown when no data
- [ ] Added to sidebar navigation if it's a top-level module
- [ ] `.env.local` has DATABASE_URL for server component DB access
