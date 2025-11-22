# Branch Protection Setup

## Required: CodeRabbit Review Before Merge

To ensure CodeRabbit feedback is provided, addressed, and comments threaded before merging:

### Option 1: Require Conversation Resolution (Recommended)

This requires all PR comments (including CodeRabbit) to be resolved before merging:

1. Go to: `https://github.com/jaredhughes/commentary/settings/branches`
2. Edit protection rules for `main` branch
3. Enable: **"Require conversation resolution before merging"**
4. This ensures all CodeRabbit comments must be addressed

### Option 2: Require CodeRabbit Status Check

If CodeRabbit provides a status check:

1. Go to: `https://github.com/jaredhughes/commentary/settings/branches`
2. Edit protection rules for `main` branch
3. Under "Require status checks to pass before merging"
4. Add CodeRabbit's status check name (check CodeRabbit settings)

### Option 3: Manual Review Requirement

Require at least one approval (which can be CodeRabbit or human):

1. Go to: `https://github.com/jaredhughes/commentary/settings/branches`
2. Edit protection rules for `main` branch
3. Enable: **"Require pull request reviews before merging"**
4. Set: **"Required number of approvals: 1"**
5. Enable: **"Dismiss stale pull request approvals when new commits are pushed"**

### Recommended Configuration

**Full Protection Rules:**
- ✅ Require a pull request before merging
- ✅ Require approvals: 1
- ✅ Dismiss stale reviews when new commits are pushed
- ✅ Require conversation resolution before merging (ensures CodeRabbit comments addressed)
- ✅ Require status checks to pass: All CI checks (build, tests)
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings

This ensures:
1. CodeRabbit reviews are provided
2. CodeRabbit comments are addressed/resolved
3. All CI checks pass
4. No bypassing protection rules

## Setting Up via GitHub CLI (if API supports)

```bash
# Note: CodeRabbit integration may require manual setup via GitHub UI
# Check CodeRabbit documentation for API-based setup options
```

## Verification

After setup, test by:
1. Creating a test PR
2. Verifying CodeRabbit review is required
3. Verifying merge is blocked until comments are resolved
4. Verifying merge works after addressing all feedback
