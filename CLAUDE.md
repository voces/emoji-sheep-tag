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

# Workflow

- Create tests, format, typecheck, lint, and run tests when done making code
  changes
