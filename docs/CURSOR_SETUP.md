# Cursor AI Configuration Guide

This document explains how Commentary is configured for optimal AI-assisted development using Cursor.

## Overview

Commentary uses Cursor AI rules and GitHub templates to streamline development workflows. This setup ensures consistent code quality, clear contribution guidelines, and effective AI assistance.

## Cursor Rules (`.cursorrules`)

The `.cursorrules` file provides context to Cursor AI about the project structure, architecture, and coding standards. This helps Cursor:

- Understand the extension's architecture and design patterns
- Generate code that follows project conventions
- Provide relevant suggestions when working on specific components
- Maintain consistency across the codebase

### Key Sections

1. **Project Overview**: High-level description of what Commentary does
2. **Architecture**: Core components and their responsibilities
3. **Design Principles**: Key architectural decisions (separation of concerns, smart anchoring, etc.)
4. **Code Style**: TypeScript conventions, VS Code API patterns
5. **Common Tasks**: Step-by-step guides for frequent operations
6. **Testing**: How to run tests and verify changes

### When to Update

Update `.cursorrules` when:
- Adding new major components or architectural patterns
- Changing coding standards or conventions
- Adding new AI providers or storage backends
- Introducing new testing patterns

## GitHub Templates

### Issue Templates

Located in `.github/ISSUE_TEMPLATE/`:

- **bug_report.md**: Structured template for bug reports
  - Environment details
  - Steps to reproduce
  - Expected vs actual behavior
  - Configuration and console output

- **feature_request.md**: Template for feature suggestions
  - Problem statement
  - Proposed solution
  - Use cases and impact assessment

- **config.yml**: Customizes the issue creation experience
  - Disables blank issues (forces template use)
  - Adds links to discussions and documentation

### Pull Request Template

Located in `.github/pull_request_template.md`:

- Type of change checklist
- Related issues linking
- Testing checklist
- Code quality verification
- Screenshots/videos for UI changes

### Contributing Guide

Located in `.github/CONTRIBUTING.md`:

- Development setup instructions
- Code style guidelines
- Testing requirements
- PR process
- Areas for contribution

## Best Practices

### For Contributors

1. **Before Creating Issues**
   - Search existing issues to avoid duplicates
   - Use the appropriate template
   - Provide all requested information
   - Include environment details and steps to reproduce

2. **Before Submitting PRs**
   - Read CONTRIBUTING.md
   - Run `npm run validate` and `npm test`
   - Use the PR template
   - Link to related issues
   - Add screenshots for UI changes

3. **When Using Cursor AI**
   - Reference `.cursorrules` for context
   - Ask about architecture before making major changes
   - Follow the code style guidelines
   - Write tests for new functionality

### For Maintainers

1. **Issue Management**
   - Label issues appropriately (bug, enhancement, etc.)
   - Triage new issues promptly
   - Close duplicates and link to originals
   - Request additional information when needed

2. **PR Review**
   - Check that PR template is filled out
   - Verify tests pass and code validates
   - Review for code style compliance
   - Test manually in Extension Development Host
   - Provide constructive feedback

3. **Updating Templates**
   - Keep templates aligned with project evolution
   - Update CONTRIBUTING.md when processes change
   - Refresh `.cursorrules` when architecture changes

## Workflow Integration

### Issue → PR Workflow

1. **Create Issue**: Use bug report or feature request template
2. **Discussion**: Use GitHub Discussions for questions/ideas
3. **Development**: Create branch, make changes, test locally
4. **PR**: Use PR template, link to issue, request review
5. **Review**: Address feedback, ensure CI passes
6. **Merge**: Squash and merge (or rebase) with conventional commit message

### AI-Assisted Development

1. **Context**: Cursor reads `.cursorrules` automatically
2. **Code Generation**: Ask Cursor to implement features following project patterns
3. **Refactoring**: Use Cursor to refactor while maintaining architecture
4. **Testing**: Generate tests using Cursor with project test patterns
5. **Documentation**: Update docs using Cursor with project style

## Continuous Improvement

These templates and rules are living documents. As the project evolves:

- Update templates based on common issues/PRs
- Refine `.cursorrules` as patterns emerge
- Improve CONTRIBUTING.md based on contributor feedback
- Add new templates for specific workflows if needed

## Resources

- [Cursor Documentation](https://cursor.sh/docs)
- [GitHub Issue Templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [VS Code Extension API](https://code.visualstudio.com/api)
