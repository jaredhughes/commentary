# Testing Strategy

## Overview

Commentary uses a two-tier testing approach due to VS Code extension testing limitations.

## Test Types

### 1. Integration Tests (`src/test/suite/`)
These tests run in a real VS Code instance using `@vscode/test-electron`. They test:
- Extension activation
- VS Code API interactions
- Storage with real workspace state
- Command registration

**Limitation**: These tests run in a spawned VS Code process, so code coverage tools (c8/nyc/istanbul) cannot instrument them properly. Coverage reporting will show 0% even though tests are passing.

### 2. Unit Tests (Future)
For pure logic that doesn't depend on VS Code APIs:
- Message formatting
- Data transformation
- File path manipulation
- Validation logic

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage reporting (informational only)
npm run test:coverage

# Watch mode
npm run watch
```

## Coverage

**Important**: Code coverage enforcement is not practical for VS Code extensions due to the testing architecture. Most VS Code extensions do not enforce coverage for the same reason.

- Integration tests: Cannot be instrumented (0% coverage shown)
- Unit tests: Can be instrumented when added

## Adding Tests

### Integration Tests
Add to `src/test/suite/` - follow existing patterns for storage, configuration, and agent tests.

### Unit Tests
Extract pure functions to separate modules and add unit tests that don't require VS Code APIs.

## CI/CD

Pre-commit hooks ensure:
- ✅ Tests pass
- ✅ Linting passes
- ✅ TypeScript compiles
- ❌ Coverage not enforced (architectural limitation)
