# Bash commands

- deno task test
- deno check: Run typechecker. Do not add -all to test everything, just run
  `deno check`
- deno lint
- deno fmt

# Code style

- Prefer arrow functions
- Prefer expression bodies for arrow functions, loops, and ifs over block bodies
  with single statements
- Prefer types over interfaces
- Avoid casting, especially to `any`. If casting is required, cast to the
  correct and minimal type
- Prefer self-documenting code over commenting. Do not leave comments regarding
  changes, only have comments about the functionality of the code, if required
- Remove unused variables instead of adding leading underscores, unless they are
  used for destructuring or skipping in a list

# Testing

- Avoid mocks in tests
- Prefer "public APIs". Emulate interaction over using functions from api/
  directories over explicitly setting state or mocking.
- Avoid tests that do not test anything. Don't bother testing basic
  functionality, but rather focus on logic that can reasonably break
- Prefer comprehensive mocking utilities with shared tooling over test-specific
  mocking
- Only use describe blocks to segment related tests; do not use them
  perfunctorily
- Aim for test driven development. When fixing a bug, first try to reproduce it
  with a test, then fix the bug

# Workflow

- Create tests, format, typecheck, lint, and run tests when done making code
  changes
- When updating shared types, remember to update corresponding zod schemas

# Game System Implementation Patterns

## Items and Buffs System

- Items with `charges` are consumable and automatically removed from inventory
  when charges reach 0
- Items with `actions` array define usable abilities that generate orders
- Buff system automatically decrements `remainingDuration` by delta time each
  frame
- Buffs with `consumeOnAttack: true` are filtered out after `damageEntity()`
  calls
- Use `newUnit(owner, prefab, x, y)` in tests instead of `ecs.addEntity()` to
  get proper prefab properties
- Test buff timing with `toBeCloseTo()` instead of `toBe()` due to delta time
  reductions

## Order System

- Create order handlers in `server/orders/` following the pattern of existing
  handlers
- Register new orders in `server/orders/index.ts`
- Order handlers have `onIssue` (queuing logic) and `onCastComplete` (effect
  logic)
- Use `findActionByOrder()` to get action properties like `buffDuration`
- Cast orders should return "complete" from `onIssue` and implement effects in
  `onCastComplete`

## Damage System Integration

- Damage calculation flows: base damage → item bonuses (additive) → buff
  multipliers
- Both `computeUnitDamage()` and `damageEntity()` need updates for new damage
  mechanics
- `damageEntity()` is called from both direct API calls and combat system
  (`tweenSwing.ts`)
- Attack completion logic exists in multiple places - ensure consistency across
  all damage paths
