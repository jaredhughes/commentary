# Agent Client Refactoring Plan

## Goal
Extract all business logic from `AgentClient` into pure, testable functions that are decoupled from VS Code APIs.

## Current Issues
1. **Tight coupling**: Business logic mixed with VS Code UI calls
2. **Hard to test**: Requires mocking vscode.* APIs
3. **Duplicate logic**: Provider selection logic in multiple places
4. **Complex methods**: `sendViaClaudeCLI`, `sendViaCursorCLI` are large and stateful

## Proposed Architecture

### 1. Pure Business Logic Layer (`src/agent/providers/`)
Extract provider-specific logic into pure functions:

```text
src/agent/providers/
??? types.ts              # Provider interfaces and types
??? claude.ts             # Pure Claude logic
??? cursor.ts             # Pure Cursor logic
??? openai.ts             # Pure OpenAI logic
??? vscode.ts             # Pure VS Code Chat logic
??? custom.ts             # Pure custom provider logic
```

### 2. Command Builders (`src/agent/commands/`)
Pure functions that build terminal commands:

```text
src/agent/commands/
??? claudeCommand.ts      # Build Claude CLI commands
??? cursorCommand.ts      # Build Cursor CLI commands
??? terminalCommand.ts    # Generic terminal command builders
```

### 3. Strategy Pattern for Providers
Each provider implements a common interface:

```typescript
interface ProviderStrategy {
  // Pure: determines if this provider can be used
  canUse(config: ProviderConfig): boolean;
  
  // Pure: builds the command/payload
  buildCommand(request: AgentRequest, config: ProviderConfig): Command;
  
  // Pure: builds user-facing message
  buildSuccessMessage(request: AgentRequest): string;
}
```

### 4. Thin Adapter Layer (`AgentClient`)
Only handles VS Code integration:
- Configuration reading
- Terminal creation
- Clipboard access
- Notifications
- Command execution

## Benefits
1. ? **Testable**: All logic can be unit tested without mocking VS Code
2. ? **Maintainable**: Clear separation of concerns
3. ? **Extensible**: Easy to add new providers
4. ? **Reusable**: Logic can be used outside VS Code if needed
5. ? **Type-safe**: Full TypeScript support with proper interfaces

## Implementation Steps
1. Create provider strategy interfaces
2. Extract Claude logic to pure functions
3. Extract Cursor logic to pure functions  
4. Create tests for each provider
5. Refactor AgentClient to use strategies
6. Add integration tests

## Test Coverage Goals
- Provider selection logic: 100%
- Command building: 100%
- Message formatting: 100%
- Config validation: 100%
