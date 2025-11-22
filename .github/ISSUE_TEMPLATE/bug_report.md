---
name: Bug Report
about: Create a report to help us improve Commentary
title: '[BUG] '
labels: bug
assignees: ''
---

## Description
A clear and concise description of what the bug is.

## Steps to Reproduce
1. Open file '...'
2. Click on '...'
3. Select text '...'
4. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- **VS Code Version**: [e.g. 1.85.0]
- **Commentary Version**: [e.g. 1.1.1]
- **OS**: [e.g. macOS 14.0, Windows 11, Ubuntu 22.04]
- **Storage Mode**: [workspace/sidecar]
- **Theme**: [e.g. water-dark]
- **Agent Provider**: [e.g. cursor/claude/openai/none]

## Configuration
```json
{
  "commentary.storage.mode": "...",
  "commentary.agent.provider": "...",
  "commentary.theme.name": "..."
}
```

## Screenshots/Videos
If applicable, add screenshots or a video to help explain the problem.

## Console Output
Open VS Code Developer Tools (`Help > Toggle Developer Tools`) and check the Console tab. Paste any relevant errors here:

```
[Paste console output here]
```

## Additional Context
Add any other context about the problem here.

## Implementation Notes (for AI agents)
<!-- AI agents: Use this section to document your investigation and proposed fix -->

### Root Cause Analysis
<!-- What component is causing the issue? What's the underlying problem? -->

### Affected Components
<!-- List files/components that need to be modified -->
- [ ] File 1: `src/path/to/file.ts` - Description
- [ ] File 2: `src/path/to/file.ts` - Description

### Proposed Solution
<!-- Describe the fix approach, following existing patterns -->

### Testing Strategy
<!-- How will you verify the fix works? -->
- [ ] Unit test: Description
- [ ] Integration test: Description
- [ ] Manual test: Steps to reproduce and verify fix

### Related Code Patterns
<!-- Reference similar implementations in the codebase that should be followed -->

## Checklist
- [ ] I've searched existing issues to avoid duplicates
- [ ] I've included all relevant environment details
- [ ] I've checked the console for errors
- [ ] I've tested with the latest version of Commentary
