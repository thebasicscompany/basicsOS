# Testing Examples

## Unit Test
```typescript
import { createUser } from "./user";

describe("createUser", () => {
  it("creates a user with valid input", () => {
    const user = createUser({ name: "Alice", email: "alice@example.com" });
    expect(user.name).toBe("Alice");
    expect(user.id).toBeDefined();
  });

  it("throws on invalid email", () => {
    expect(() => createUser({ name: "Alice", email: "invalid" }))
      .toThrow("Invalid email");
  });
});
```

## Integration Test
```typescript
import { createApp } from "../app";
import request from "supertest";

describe("POST /api/users", () => {
  const app = createApp();

  it("returns 201 with created user", async () => {
    const res = await request(app)
      .post("/api/users")
      .send({ name: "Alice", email: "alice@example.com" });

    expect(res.status).toBe(201);
    expect(res.body.user.name).toBe("Alice");
  });
});
```
