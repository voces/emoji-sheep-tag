# Bash commands

- deno task test
- deno check: Run typechecker
- deno lint
- deno fmt

# Code style

- Prefer arrow functions
- Prefer expression bodies for arrow functions, loops, and ifs over block bodies
  with single statements
- Prefer types over interfaces
- Avoid mocks in tests
- Prefer functions from api/ directories to simulate state or interaction
- Avoid casting, especially to `any`. If casting is required, cast to the
  correct type
- Prefer self-documenting code over commenting
- Remove unused variables instead of adding leading underscores, unless they are
  used for destructuring or skipping in a list

# Workflow

- Typecheck, lint, and run tests when done making code changes
