# Contributing to Commentary

Thank you for your interest in contributing to Commentary! This document provides guidelines and instructions for contributing.

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js 18.x or 20.x
- npm (comes with Node.js)
- VS Code (for testing the extension)
- Git

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/commentary.git
   cd commentary
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Compile the extension**
   ```bash
   npm run compile
   ```

4. **Open in VS Code**
   ```bash
   code .
   ```

5. **Run tests**
   ```bash
   npm test
   ```

6. **Validate code**
   ```bash
   npm run validate  # Runs ESLint + TypeScript type checking
   ```

## Development Workflow

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**
   - Follow the code style guidelines (see below)
   - Write or update tests as needed
   - Update documentation if necessary

3. **Test your changes**
   - Run `npm run validate` to check linting and types
   - Run `npm test` to ensure all tests pass
   - Press `F5` in VS Code to launch Extension Development Host and test manually
   - Test with both workspace and sidecar storage modes
   - Test with different themes if UI-related

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```
   
   Use conventional commit messages:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `refactor:` for code refactoring
   - `test:` for test changes
   - `chore:` for maintenance tasks

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style

- **TypeScript**: Strict mode enabled, no `any` types
- **ESLint**: Follow the rules in `.eslintrc.json`
- **Naming**: camelCase for variables/functions, PascalCase for types/classes
- **Async**: Use async/await, not promises or callbacks
- **Comments**: Add comments for non-obvious logic or domain-specific nuances
- **Formatting**: Run `npm run lint` before committing

### Testing Guidelines

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test component interactions
- **Manual Testing**: Always test in Extension Development Host (F5)
- **Test Coverage**: Aim to maintain or improve test coverage
- **Test Files**: Place test files next to source files (e.g., `file.test.ts`)

### Architecture Guidelines

- **Separation of Concerns**: Keep business logic separate from VS Code API calls
- **Provider Pattern**: Use interfaces for AI agent providers
- **Storage Abstraction**: Use storage interface for different backends
- **Message Protocol**: Follow existing message types in `src/types.ts`

## Pull Request Process

1. **Before submitting**
   - Ensure all tests pass (`npm test`)
   - Run validation (`npm run validate`)
   - Update CHANGELOG.md if applicable
   - Update README.md if adding features or changing behavior

2. **PR Description**
   - Use the PR template
   - Clearly describe what changes were made and why
   - Link to related issues
   - Include screenshots/videos for UI changes

3. **Review Process**
   - PRs require at least one approval
   - Address all review comments
   - Keep PRs focused (one feature/fix per PR)
   - Keep PRs reasonably sized (prefer multiple smaller PRs over one large one)

## Issue Guidelines

### Reporting Bugs

- Use the bug report template
- Include steps to reproduce
- Provide environment details (VS Code version, OS, etc.)
- Include console errors if applicable
- Add screenshots/videos if helpful

### Requesting Features

- Use the feature request template
- Clearly describe the problem and proposed solution
- Consider alternatives and impact
- Provide use cases and examples

## Areas for Contribution

We welcome contributions in these areas:

- **Bug Fixes**: Fix reported issues
- **New Features**: Add functionality requested by users
- **Documentation**: Improve README, code comments, or guides
- **Tests**: Increase test coverage
- **Performance**: Optimize existing code
- **Themes**: Add new Markdown themes
- **AI Providers**: Add support for new AI agents
- **Accessibility**: Improve accessibility features
- **Internationalization**: Add i18n support

## For AI Agents

If you're an AI agent implementing issues:

1. **Start with**: `.github/AI_QUICK_START.md` for fast reference
2. **Read**: `docs/AI_IMPLEMENTATION_GUIDE.md` for detailed patterns
3. **Follow**: `.cursorrules` for all code patterns
4. **Use**: Issue templates with implementation notes
5. **Complete**: PR template with implementation details

**Key Requirements:**
- Always run `npm run validate && npm test` before committing
- Always write tests alongside implementation
- Always follow existing code patterns exactly
- Always update CHANGELOG.md for user-facing changes
- Always test manually in Extension Development Host (F5)

## Questions?

- Open an issue for questions or discussions
- Check existing issues and PRs first
- Be patient and respectful in all interactions
- For AI agents: Check `.github/AI_QUICK_START.md` first

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
