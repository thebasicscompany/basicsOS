# Auth — Infrastructure Context

## Stack
- **Library**: Better Auth v1 (`packages/auth/`)
- **Storage**: Drizzle adapter → same PostgreSQL database (users, sessions tables)
- **Roles**: admin | member | viewer
- **Tokens**: JWT containing `userId` and `tenantId`

## tRPC Procedure Guards

```ts
// protectedProcedure — requires valid session
// userId and role are guaranteed non-null; tenantId may be null (fresh users)
protectedProcedure.query(({ ctx }) => {
  if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
  // ... tenant-scoped query
});

// memberProcedure — requires session + tenantId (guaranteed non-null)
// Throws FORBIDDEN for Viewer role
memberProcedure.mutation(({ ctx, input }) => {
  // ctx.tenantId is string (non-null)
  // ctx.userId is string (non-null)
  // ctx.role is "admin" | "member"
});

// adminProcedure — requires Admin role + tenantId
// Throws FORBIDDEN for Member and Viewer
adminProcedure.mutation(({ ctx, input }) => {
  // ctx.role is guaranteed "admin"
  // ctx.tenantId is guaranteed non-null
});
```

## Role Hierarchy

```
admin  → can do everything (team management, billing, module config, kill switches)
member → can create/edit content (tasks, docs, deals, meetings)
viewer → read-only access to all content
```

## Context Shape

```ts
type TRPCContext = {
  db: DbConnection;
  userId: string | null;        // null = unauthenticated
  tenantId: string | null;      // null = no tenant yet (fresh registration)
  role: UserRole | null;        // "admin" | "member" | "viewer"
  sessionId: string | null;
  headers: Headers;
};
```

## Invite Flow

```
Admin calls auth.sendInvite({ email, role })
  → Inserts invite row with random token, 7-day expiry
  → TODO: Email delivery (needs Resend/Postmark configured via BETTER_AUTH_EMAIL_*)

Invitee opens link → calls auth.validateInvite({ token })
  → Returns { email, role, tenantId } if valid
  → Throws CONFLICT if already used, FORBIDDEN if expired

Invitee completes registration → Better Auth creates user with tenantId
```

## Environment Variables

```bash
BETTER_AUTH_SECRET=...          # Required — 32-byte hex secret
BETTER_AUTH_URL=...             # Required — app base URL (for email callbacks)
```

## Checking Auth in Non-tRPC Code

```ts
import { auth } from "@basicsos/auth";

// In a Hono route or server action:
const session = await auth.api.getSession({ headers: request.headers });
if (!session?.user) return c.json({ error: "Unauthorized" }, 401);

const raw = session.user as Record<string, unknown>;
const tenantId = typeof raw["tenantId"] === "string" ? raw["tenantId"] : null;
```

## Adding Custom User Fields

User fields are stored in the `users` table (`packages/db/src/schema/tenants.ts`).
Better Auth doesn't auto-sync custom fields — update via tRPC `admin.updateUser` or direct DB mutation.
