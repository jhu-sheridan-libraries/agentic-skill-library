<!-- forge:version 0.1.7 -->
# Drive Tests

Test-driven development with red-green-refactor vertical slices. Build features or fix bugs by writing one test at a time, implementing just enough code to pass, then refactoring.

## When to Use

- The user wants to build features or fix bugs using TDD
- The user mentions "red-green-refactor" or "test-first"
- The user wants integration tests that verify behavior through public interfaces
- The user asks for test-driven development

## Prerequisites

- A test runner configured in the project (see Troubleshooting in POWER.md if missing)
- Clear understanding of the feature or bug to implement

## Shared Concepts

This workflow relies on "deep modules" and "vertical slices" as defined in the POWER.md Shared Concepts section. Deep modules have small interfaces hiding significant complexity. Vertical slices cut thin end-to-end paths through all layers — one test, one implementation, repeat.

## Philosophy

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests should not. Good tests are integration-style: they exercise real code paths through public APIs and describe _what_ the system does, not _how_. A good test reads like a specification.

Bad tests are coupled to implementation — they mock internal collaborators, test private methods, or verify through external means. The warning sign: your test breaks when you refactor, but behavior has not changed.

## Anti-Pattern: Horizontal Slices

Do NOT write all tests first, then all implementation. This is horizontal slicing — treating RED as "write all tests" and GREEN as "write all code." Tests written in bulk test imagined behavior, not actual behavior. You outrun your headlights, committing to test structure before understanding the implementation.

Correct approach: vertical slices via tracer bullets. One test → one implementation → repeat.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
```

## Phases

### Phase 1 — Planning
Confirm interface changes, prioritize behaviors to test, identify deep module opportunities, and get user approval on the plan.
→ Load `drive-tests-planning.md`

### Phase 2 — Tracer Bullet
Write ONE test that confirms ONE thing about the system end-to-end. This proves the path works.
→ Load `drive-tests-tracer-bullet.md`

### Phase 3 — Incremental Loop
For each remaining behavior: write one test (RED), write minimal code to pass (GREEN). One test at a time, no anticipating future tests.
→ Load `drive-tests-incremental-loop.md`

### Phase 4 — Refactor
After all tests pass, look for refactor candidates. Never refactor while RED — get to GREEN first.
→ Load `drive-tests-refactor.md`

## Checklist Per Cycle

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Code is minimal for this test
[ ] No speculative features added
```

---

## Appendix A: Good and Bad Tests

### Good Tests

Integration-style: test through real interfaces, not mocks of internal parts.

```typescript
// GOOD: Tests observable behavior
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

Characteristics:
- Tests behavior users/callers care about
- Uses public API only
- Survives internal refactors
- Describes WHAT, not HOW
- One logical assertion per test

### Bad Tests

Implementation-detail tests: coupled to internal structure.

```typescript
// BAD: Tests implementation details
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

Red flags:
- Mocking internal collaborators
- Testing private methods
- Asserting on call counts/order
- Test breaks when refactoring without behavior change
- Test name describes HOW not WHAT
- Verifying through external means instead of interface

```typescript
// BAD: Bypasses interface to verify
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// GOOD: Verifies through interface
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

---

## Appendix B: When to Mock

Mock at system boundaries only:
- External APIs (payment, email, etc.)
- Databases (sometimes — prefer test DB)
- Time/randomness
- File system (sometimes)

Do not mock:
- Your own classes/modules
- Internal collaborators
- Anything you control

### Designing for Mockability

At system boundaries, design interfaces that are easy to mock:

**1. Use dependency injection**

Pass external dependencies in rather than creating them internally:

```typescript
// Easy to mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Hard to mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. Prefer SDK-style interfaces over generic fetchers**

Create specific functions for each external operation instead of one generic function with conditional logic:

```typescript
// GOOD: Each function is independently mockable
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// BAD: Mocking requires conditional logic inside the mock
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

The SDK approach means:
- Each mock returns one specific shape
- No conditional logic in test setup
- Easier to see which endpoints a test exercises
- Type safety per endpoint

---

## Appendix C: Deep Modules

From "A Philosophy of Software Design":

**Deep module** = small interface + lots of implementation

```
┌─────────────────────┐
│   Small Interface   │  ← Few methods, simple params
├─────────────────────┤
│                     │
│                     │
│  Deep Implementation│  ← Complex logic hidden
│                     │
│                     │
└─────────────────────┘
```

**Shallow module** = large interface + little implementation (avoid)

```
┌─────────────────────────────────┐
│       Large Interface           │  ← Many methods, complex params
├─────────────────────────────────┤
│  Thin Implementation            │  ← Just passes through
└─────────────────────────────────┘
```

When designing interfaces, ask:
- Can I reduce the number of methods?
- Can I simplify the parameters?
- Can I hide more complexity inside?

See the POWER.md Shared Concepts section for the full "deep modules" definition used across codeshop workflows.

---

## Appendix D: Interface Design for Testability

Good interfaces make testing natural:

1. **Accept dependencies, don't create them**

   ```typescript
   // Testable
   function processOrder(order, paymentGateway) {}

   // Hard to test
   function processOrder(order) {
     const gateway = new StripeGateway();
   }
   ```

2. **Return results, don't produce side effects**

   ```typescript
   // Testable
   function calculateDiscount(cart): Discount {}

   // Hard to test
   function applyDiscount(cart): void {
     cart.total -= discount;
   }
   ```

3. **Small surface area**
   - Fewer methods = fewer tests needed
   - Fewer params = simpler test setup

---

## Appendix E: Refactor Candidates

After the TDD cycle, look for:

- **Duplication** → Extract function/class
- **Long methods** → Break into private helpers (keep tests on public interface)
- **Shallow modules** → Combine or deepen
- **Feature envy** → Move logic to where data lives
- **Primitive obsession** → Introduce value objects
- **Existing code** the new code reveals as problematic