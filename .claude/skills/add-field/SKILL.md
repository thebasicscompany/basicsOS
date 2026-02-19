# Skill: Add a Field to a Module

## When to Use
Adding a new column to an existing database table and surfacing it through the API.

## Steps

### 1. Add to Schema (`packages/db/src/schema/[module].ts`)
```ts
myTable = pgTable("my_table", {
  ...,
  newField: text("new_field"),                    // nullable
  requiredField: text("required_field").notNull(), // required
  jsonField: jsonb("json_field").notNull().default({}), // JSON
  enumField: text("status").notNull().default("active"), // enum (use z.enum in validator)
});
```

### 2. Run Migration
```bash
bun db:generate   # creates SQL file in packages/db/migrations/
bun db:migrate    # applies to database
```

### 3. Update Zod Validator (`packages/shared/src/validators/[module].ts`)
```ts
export const insertMySchema = z.object({
  tenantId: z.string().uuid(),
  ...,
  newField: z.string().optional(),          // nullable
  requiredField: z.string().min(1),         // required
  jsonField: z.record(z.unknown()).default({}), // JSON
  enumField: z.enum(["active", "inactive"]).default("active"),
});
```

### 4. Update tRPC Router (`packages/api/src/routers/[module].ts`)
- Add `newField` to the `.input()` schema of `create` and `update` procedures
- For `update`, the field should be `.optional()` (partial updates)
- Return it in `.select()` projections if you're using column selects

### 5. Update Tests
Add test cases to `packages/api/src/routers/[module].test.ts`:
```ts
it("stores and returns newField", async () => {
  const row = makeMyModel({ newField: "test-value" });
  const db = makeMockDb({ insertRows: [row] });
  const result = await caller(ctx).create({ ..., newField: "test-value" });
  expect(result.newField).toBe("test-value");
});
```

## Checklist
- [ ] Schema column added
- [ ] Migration generated and applied
- [ ] Zod validator updated (insert + update schemas)
- [ ] tRPC input schemas updated
- [ ] Tests updated
- [ ] (Optional) UI form field added
