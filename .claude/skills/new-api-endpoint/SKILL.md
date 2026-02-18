# Skill: Add a tRPC Endpoint

## When to Use
Adding a new query or mutation to an existing module router.

## Procedure Templates

### Query (read data)
```ts
myProcedure: protectedProcedure
  .input(z.object({
    id: z.string().uuid(),
    limit: z.number().int().min(1).max(100).default(20),
  }))
  .query(async ({ ctx, input }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
    const [result] = await ctx.db
      .select()
      .from(myTable)
      .where(and(eq(myTable.id, input.id), eq(myTable.tenantId, ctx.tenantId)));
    if (!result) throw new TRPCError({ code: "NOT_FOUND" });
    return result;
  }),
```

### Mutation (write data)
```ts
myMutation: memberProcedure
  .input(z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
  }))
  .mutation(async ({ ctx, input }) => {
    const [updated] = await ctx.db
      .update(myTable)
      .set({ name: input.name, updatedAt: new Date() })
      .where(and(eq(myTable.id, input.id), eq(myTable.tenantId, ctx.tenantId)))
      .returning();
    if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
    EventBus.emit(createEvent({
      type: "my_module.updated",
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      payload: { id: updated.id },
    }));
    return updated;
  }),
```

## Procedure Choice

| Procedure | Use when | ctx.tenantId |
|-----------|----------|-------------|
| `publicProcedure` | No auth required (health check, branding) | may be null |
| `protectedProcedure` | Any logged-in user; check tenantId manually | may be null |
| `memberProcedure` | Writing data; member or admin | guaranteed non-null string |
| `adminProcedure` | Admin-only actions | guaranteed non-null string |

## Error Codes

```ts
throw new TRPCError({ code: "UNAUTHORIZED" });  // not logged in / no tenant
throw new TRPCError({ code: "FORBIDDEN" });      // wrong role
throw new TRPCError({ code: "NOT_FOUND" });      // record doesn't exist
throw new TRPCError({ code: "CONFLICT" });       // duplicate / already exists
throw new TRPCError({ code: "BAD_REQUEST", message: "Specific reason" });
throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); // DB insert returned nothing
```

## Writing Tests

```ts
describe("myModule.myProcedure", () => {
  it("returns data for valid input", async () => {
    const row = makeMyModel();
    const db = makeMockDb({ selectRows: [row] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    const result = await myRouter.createCaller(ctx).myProcedure({ id: MY_ID });
    expect(result).toMatchObject({ id: MY_ID });
  });

  it("throws NOT_FOUND for unknown id", async () => {
    const db = makeMockDb({ selectRows: [] });
    const ctx = buildCtx({ db: db as unknown as TRPCContext["db"] });
    await expect(myRouter.createCaller(ctx).myProcedure({ id: UNKNOWN_ID }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
```

## Checklist
- [ ] Procedure added to router with correct procedure type
- [ ] Input validated with Zod
- [ ] Tenant isolation enforced (tenantId in WHERE or via memberProcedure)
- [ ] Event emitted after mutations
- [ ] Error cases handled (NOT_FOUND, CONFLICT, etc.)
- [ ] Tests written for happy path + error cases
