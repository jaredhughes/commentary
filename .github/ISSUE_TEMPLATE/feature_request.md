---
name: Feature Request
about: Suggest an idea for Commentary
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

## Problem Statement
What problem would this feature solve? What use case does it address?

## Proposed Solution
A clear and concise description of what you want to happen.

## Alternatives Considered
A clear and concise description of any alternative solutions or features you've considered.

## Use Cases
Describe specific scenarios where this feature would be helpful:
1. Use case 1: ...
2. Use case 2: ...

## Mockups/Examples
If applicable, add mockups, screenshots, or examples of similar features in other tools.

## Impact
- **User Impact**: [High/Medium/Low]
- **Complexity**: [High/Medium/Low]
- **Breaking Changes**: [Yes/No - if yes, describe]

## Implementation Plan (for AI agents)
<!-- AI agents: Use this section to plan the implementation -->

### Acceptance Criteria
<!-- Define what "done" looks like - be specific and testable -->
- [ ] Criterion 1: Specific, measurable outcome
- [ ] Criterion 2: Specific, measurable outcome
- [ ] Criterion 3: Specific, measurable outcome

### Architecture Changes
<!-- What components need to be created or modified? -->
- [ ] New file: `src/path/to/newComponent.ts` - Purpose
- [ ] Modify: `src/path/to/existingFile.ts` - Changes needed
- [ ] Update types: `src/types.ts` - New interfaces/enums

### Implementation Steps
<!-- Break down into concrete, actionable steps -->
1. **Step 1**: Create new component/file
   - Files: `src/path/file.ts`
   - Tests: `src/path/file.test.ts`
   - Pattern to follow: `src/similar/component.ts`

2. **Step 2**: Register command/handler
   - Command: `commentary.newCommand`
   - Handler location: `src/sidebar/commands.ts`
   - Menu registration: `package.json` contributes.menus

3. **Step 3**: Add tests
   - Unit tests: `src/path/file.test.ts`
   - Integration tests: `src/path/file.integration.test.ts`

4. **Step 4**: Update documentation
   - README.md: User-facing documentation
   - CHANGELOG.md: Release notes

### Similar Implementations
<!-- Reference existing code that follows similar patterns -->
- Similar feature: `src/path/to/similar.ts` - Use as reference
- Pattern: Description of pattern to follow

### Testing Requirements
<!-- Specific test cases that must pass -->
- [ ] Test case 1: Description
- [ ] Test case 2: Description
- [ ] Edge case 1: Description
- [ ] Error case 1: Description

### Configuration Changes (if needed)
<!-- New settings or changes to existing settings -->
- Setting: `commentary.new.setting`
- Type: `string` | `number` | `boolean`
- Default: `"value"`
- Description: "What this setting does"

### Dependencies
<!-- Any new npm packages or VS Code API features needed -->
- Package: `package-name` - Purpose
- VS Code API: `vscode.feature` - Purpose

## Additional Context
Add any other context, examples, or references about the feature request here.

## Checklist
- [ ] I've searched existing issues to avoid duplicates
- [ ] I've considered the impact on existing functionality
- [ ] I've thought about backwards compatibility
- [ ] I've provided implementation guidance for AI agents
