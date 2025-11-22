# Commit Signing Setup

## Issue: Commits Show as Unverified

Your commits are signed locally with SSH, but GitHub doesn't recognize them because the signing key isn't registered on your GitHub account.

## Solution: Add SSH Signing Key to GitHub

### Step 1: Get Your Current Signing Key

```bash
# Check what key Git is using for signing
git config --get user.signingkey

# Get the public key content
cat ~/.ssh/id_ed25519.pub
# Or if using a different key:
cat ~/.ssh/id_rsa.pub
```

### Step 2: Add Key to GitHub

**Option A: Via GitHub Web UI**
1. Go to: https://github.com/settings/keys
2. Click "New SSH key"
3. Title: "Commit Signing Key" (or similar)
4. Key type: **Signing Key** (important!)
5. Paste your public key
6. Click "Add SSH key"

**Option B: Via GitHub CLI**
```bash
# Get your public key
PUBLIC_KEY=$(cat ~/.ssh/id_ed25519.pub)

# Add it as a signing key
gh ssh-key add ~/.ssh/id_ed25519.pub --title "Commit Signing Key" --type signing
```

### Step 3: Verify Configuration

```bash
# Check Git signing config
git config --get user.signingkey
git config --get commit.gpgsign
git config --get gpg.format

# Should show:
# - user.signingkey: Your SSH key
# - commit.gpgsign: true
# - gpg.format: ssh
```

### Step 4: Test Signing

```bash
# Make a test commit
echo "test" > /tmp/test.txt
git add /tmp/test.txt
git commit -m "test: verify commit signing"
git log --show-signature -1

# Should show "Good 'git' signature"
```

### Step 5: Verify on GitHub

After pushing, check your commit on GitHub - it should show "Verified" badge.

## Current Status

- ✅ Git is configured to sign commits (`commit.gpgsign = true`)
- ✅ Using SSH signing (`gpg.format = ssh`)
- ❌ Signing key not registered on GitHub (or different key registered)

## Quick Fix

If you want to use the key already on GitHub:

1. Get the key ID from GitHub:
```bash
gh api user/ssh_signing_keys --jq '.[0].key'
```

2. Update local Git config to use that key (if it's in your ~/.ssh/):
```bash
# Find which local key matches
ssh-keygen -lf ~/.ssh/id_ed25519.pub
# Compare fingerprint with GitHub key
```

3. Or add your current signing key to GitHub (recommended)

## Troubleshooting

**Commits still show as unverified:**
- Ensure the key on GitHub is marked as a "Signing Key" (not just SSH key)
- Verify the key fingerprint matches: `ssh-keygen -lf ~/.ssh/id_ed25519.pub`
- Check GitHub shows the key: https://github.com/settings/keys

**"No secret key" error:**
- Ensure the private key exists: `ls -la ~/.ssh/id_ed25519`
- Check SSH agent has the key: `ssh-add -l`

**Wrong key being used:**
- Check current config: `git config --get user.signingkey`
- Update if needed: `git config user.signingkey "ssh-ed25519 YOUR_KEY_HERE"`
