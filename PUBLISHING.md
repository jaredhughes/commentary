# Publishing Commentary to VS Code Marketplace

This guide will help you publish the Commentary extension to the VS Code Marketplace.

## 🚀 Quick Start (If You're Getting Azure AD Errors)

**If you're seeing the "AADSTS16000" or "AADSTS50020" error**, your personal Microsoft account isn't registered with Azure DevOps. Here are your options:

### Option A: Use GitHub Authentication (Recommended!)

**GitHub sign-in often works when Microsoft account doesn't!**

1. **Access marketplace with GitHub:**
   - Go to: https://marketplace.visualstudio.com/manage/publishers
   - Click "Sign in" and choose **"Sign in with GitHub"** option
   - Authorize the marketplace to access your GitHub account
   - This bypasses the Azure AD issues completely!

2. **Create your publisher:**
   - Once signed in with GitHub, click "Create Publisher"
   - **Publisher ID**: `jaredhughes` (must match your `package.json`)
   - **Display Name**: Your name or organization
   - **Owner**: Your email

3. **Upload your extension:**
   - Package: `vsce package` (creates `.vsix` file)
   - Go to your publisher page
   - Click "New extension" → "Visual Studio Code"
   - Upload the `.vsix` file

**Note:** If you already have a publisher created with a Microsoft account, you may need to use that same account or transfer ownership. But if you're creating a new publisher, GitHub authentication is often the easiest path!

2. **If marketplace works, you can manually upload:**
   - Package: `vsce package`
   - Upload the `.vsix` file via the web UI

### Option B: Register Account via Alternative Method

Try registering your account through other Microsoft services first:

1. **Try GitHub integration:**
   - Go to: https://github.com/settings/connections/applications
   - Look for "Visual Studio Code" or "Azure DevOps"
   - This sometimes helps register the account

2. **Try creating a free Azure account:**
   - Go to: https://azure.microsoft.com/free/
   - Sign up with your Microsoft account
   - This may register your account with Azure services
   - Then try Azure DevOps again

### Option C: Create New Microsoft Account (Last Resort)

If nothing works, create a new Microsoft account specifically for publishing:
1. Create new account at: https://signup.live.com
2. Use this account only for VS Code marketplace publishing
3. Create publisher with this account

---

## ✅ Prerequisites Checklist

Your extension is already configured correctly:
- ✅ **Publisher ID**: `jaredhughes` (set in `package.json`)
- ✅ **Extension Name**: `commentary`
- ✅ **Version**: `0.9.8` (current)
- ✅ **Icon**: `images/icon.png` (128x128px)
- ✅ **CHANGELOG.md**: Present and formatted
- ✅ **`.vscodeignore`**: Configured to exclude dev files
- ✅ **`vsce`**: Installed (version 3.6.2)
- ✅ **License**: MIT (specified in `package.json`)
- ✅ **Repository**: GitHub URL configured

## 📋 Step-by-Step Publishing Process

### Step 1: Get a Personal Access Token (PAT)

1. **Go to Azure DevOps**
   - Visit: https://dev.azure.com
   - Sign in with your Microsoft account (the one associated with your publisher ID)

2. **Create Personal Access Token**
   - Click your profile icon (top right) → **User settings** → **Personal access tokens**
   - Or go directly to: https://dev.azure.com/_usersSettings/tokens
   - Click **+ New Token**

3. **Configure the Token**
   - **Name**: `VS Code Extension Publishing` (or any descriptive name)
   - **Organization**: Select your organization (or "All accessible organizations")
   - **Expiration**: Choose duration (90 days, 1 year, or custom)
   - **Scopes**: Select **Custom defined**
     - Under **Marketplace**, check:
       - ✅ **Manage** (full access to publish extensions)

4. **Create and Copy Token**
   - Click **Create**
   - **IMPORTANT**: Copy the token immediately (you won't see it again!)
   - Store it securely (password manager, etc.)

### Step 2: Verify Your Publisher Account

1. **Check Publisher Status**
   - Visit: https://marketplace.visualstudio.com/manage/publishers
   - Sign in with your Microsoft account
   - Verify that publisher ID `jaredhughes` exists or create it if needed

2. **If Creating New Publisher**
   - Click **Create Publisher**
   - **Publisher ID**: `jaredhughes` (must match `package.json`)
   - **Display Name**: Your name or organization name
   - **Owner**: Your email address

### Step 3: Prepare for Publishing

1. **Update Version (if needed)**
   ```bash
   # If you need to bump version before publishing
   # Edit package.json: "version": "0.9.9"
   # Update CHANGELOG.md with new version entry
   ```

2. **Build and Validate**
   ```bash
   npm run compile
   npm run validate
   npm test
   ```

3. **Package Extension (Optional - for testing)**
   ```bash
   vsce package
   # Creates: commentary-0.9.8.vsix
   ```

### Step 4: Publish to Marketplace

**Option A: Publish with Token (Recommended)**
```bash
vsce publish -p <YOUR_PERSONAL_ACCESS_TOKEN>
```

**Option B: Publish with Interactive Login**
```bash
vsce publish
# Will prompt for Personal Access Token
```

**Option C: Publish Minor/Patch Update**
```bash
vsce publish minor  # Bumps 0.9.8 → 0.10.0
vsce publish patch  # Bumps 0.9.8 → 0.9.9
```

### Step 5: Verify Publication

1. **Check Marketplace**
   - Visit: https://marketplace.visualstudio.com/items?itemName=jaredhughes.commentary
   - It may take a few minutes to appear

2. **Test Installation**
   - Open VS Code
   - Go to Extensions view (`⌘⇧X` / `Ctrl+Shift+X`)
   - Search for "Commentary"
   - Install and verify it works

## 🔄 Updating the Extension

For future updates:

1. **Update Version**
   ```bash
   # Edit package.json
   "version": "0.9.9"  # or use vsce publish minor/patch
   ```

2. **Update CHANGELOG.md**
   - Add new version entry at the top
   - Document changes (Added, Changed, Fixed, etc.)

3. **Publish**
   ```bash
   npm run compile
   vsce publish -p <YOUR_PERSONAL_ACCESS_TOKEN>
   ```

## 🚨 Troubleshooting

### Error: "AADSTS16000: User account does not exist in tenant"

**This is the error you're seeing!** This happens when using a personal Microsoft account (@outlook.com, @hotmail.com, @live.com) with Azure DevOps.

**Solution 1: Use Personal Access Token (Recommended)**
- **Skip interactive login entirely** by using a PAT directly:
  ```bash
  vsce publish -p <YOUR_PERSONAL_ACCESS_TOKEN>
  ```
- This bypasses the Azure AD authentication issue completely
- You can create a PAT even if you can't access Azure DevOps directly (see Solution 2)

**Solution 2: Access Azure DevOps via Browser First**
1. Go to https://dev.azure.com in your browser
2. Sign in with your Microsoft account
3. If you see an error, try:
   - Creating a new organization: https://dev.azure.com (click "Create new organization")
   - This will properly register your account with Azure DevOps
4. Once you can access Azure DevOps, create a PAT:
   - Go to: https://dev.azure.com/_usersSettings/tokens
   - Or: Profile icon → User settings → Personal access tokens
5. Create token with **Marketplace → Manage** scope

**Solution 3: Use Different Account**
- If you have a work/school Microsoft account, try using that instead
- Or create a new Microsoft account specifically for publishing

**Solution 4: Manual Upload via Marketplace Web UI (Works Even If Azure DevOps Doesn't)**

This is often the most reliable method when Azure DevOps access fails:

1. **Package the extension:**
   ```bash
   npm run compile
   vsce package
   ```
   This creates `commentary-0.9.8.vsix`

2. **Access marketplace directly:**
   - Go to: https://marketplace.visualstudio.com/manage/publishers
   - Try signing in - sometimes this works even when Azure DevOps doesn't
   - If you can sign in, create publisher `jaredhughes` if it doesn't exist

3. **Upload the extension:**
   - Go to: https://marketplace.visualstudio.com/manage/publishers/jaredhughes
   - Click "New extension" → "Visual Studio Code"
   - Upload the `.vsix` file
   - Fill in the required information
   - Submit for review

**Note:** The marketplace web UI uses different authentication than Azure DevOps, so it may work even when Azure DevOps fails.

**Solution 5: Use GitHub Actions (If You Have GitHub)**
- Set up automated publishing via GitHub Actions
- This uses service account authentication
- See: https://github.com/marketplace/actions/publish-vs-code-extension

### Error: "Publisher not found"
- Verify publisher ID matches in `package.json` and Azure DevOps
- Create publisher at: https://marketplace.visualstudio.com/manage/publishers
- **Note**: You may need to access this via browser first to set up your account

### Error: "Invalid Personal Access Token"
- Token may have expired
- Verify token has "Manage" scope under Marketplace
- Create a new token if needed
- Make sure you're using the token with `-p` flag: `vsce publish -p <token>`

### Error: "Extension name already exists"
- Your extension ID is `jaredhughes.commentary`
- If this error appears, the extension may already be published
- Check: https://marketplace.visualstudio.com/items?itemName=jaredhughes.commentary

### Error: "Version already exists"
- Bump version in `package.json` before publishing
- Or use `vsce publish minor` or `vsce publish patch`

### Extension not appearing in search
- Wait 5-10 minutes for indexing
- Try direct link: `vscode:extension/jaredhughes.commentary`
- Clear VS Code extension cache if needed

## 📝 Post-Publishing Checklist

- [ ] Extension appears in marketplace
- [ ] README displays correctly
- [ ] Icon displays correctly
- [ ] Installation works from marketplace
- [ ] All features work as expected
- [ ] Update README.md to remove "(Publishing soon)" note
- [ ] Consider adding marketplace badges to README

## 🔗 Useful Links

- **Marketplace Publisher Dashboard**: https://marketplace.visualstudio.com/manage/publishers
- **Your Extension Page**: https://marketplace.visualstudio.com/items?itemName=jaredhughes.commentary
- **Personal Access Tokens**: https://dev.azure.com/_usersSettings/tokens
- **VS Code Extension Publishing Docs**: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- **vsce CLI Docs**: https://github.com/microsoft/vscode-vsce

## 💡 Tips

1. **Keep Token Secure**: Never commit PAT to git. Use environment variables or secure storage.

2. **Version Strategy**: 
   - Use semantic versioning (major.minor.patch)
   - `vsce publish minor` for new features
   - `vsce publish patch` for bug fixes

3. **CHANGELOG**: Keep it updated! Users rely on it to see what's new.

4. **Testing**: Always test the packaged `.vsix` file before publishing:
   ```bash
   vsce package
   code --install-extension commentary-0.9.8.vsix
   ```

5. **Preview Flag**: Your extension has `"preview": true` in `package.json`, which means it will be marked as "Preview" in the marketplace. Remove this when ready for stable release.

---

**Ready to publish?** Run:
```bash
vsce publish -p <YOUR_PERSONAL_ACCESS_TOKEN>
```

Good luck! 🚀
