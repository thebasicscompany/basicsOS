# Architecture Patterns Reference

## Module Pattern
```typescript
// Named exports only
export function createService(config: ServiceConfig): Service {
  // ...
}

export interface ServiceConfig {
  // ...
}
```

## Error Handling
- Validate at system boundaries (user input, external APIs)
- Trust internal code — don't add redundant checks
- Use typed errors for expected failure modes
- Let unexpected errors propagate to top-level handlers

## State Management
- Keep state as close to where it's used as possible
- Lift state only when genuinely shared between siblings
- Prefer derived/computed values over stored state

## API Design
- Use consistent naming: `getX`, `createX`, `updateX`, `deleteX`
- Return typed results, not raw responses
- Handle pagination at the service layer
