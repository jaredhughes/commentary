/**
 * Commentary Extension - Main entry point
 * Google Docs-style commenting for rendered Markdown in VS Code
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StorageManager } from './storage';
import { OverlayHost } from './preview/overlayHost';
import { CommentsViewProvider } from './sidebar/commentsView';
import { CommandManager } from './sidebar/commands';
import { AgentClient } from './agent/client';
import { MarkdownWebviewProvider } from './preview/markdownWebview';
import { CommentaryFileDecorationProvider } from './decorations/fileDecorationProvider';
import { detectOptimalProvider, getProviderSetupMessage } from './agent/providerDetection';

let overlayHost: OverlayHost | undefined;
let storageManager: StorageManager | undefined;
let commentsViewProvider: CommentsViewProvider | undefined;
let commentsTreeView: vscode.TreeView<vscode.TreeItem> | undefined;
let markdownWebviewProvider: MarkdownWebviewProvider | undefined;
let fileDecorationProvider: CommentaryFileDecorationProvider | undefined;
let isActivating = false;
let documentChangeTimer: NodeJS.Timeout | undefined;

/**
 * Validate that theme files exist in the extension
 * Provides helpful error messages if themes are missing
 */
async function validateThemeFiles(context: vscode.ExtensionContext): Promise<void> {
  const themesDir = vscode.Uri.joinPath(context.extensionUri, 'media', 'themes');
  const config = vscode.workspace.getConfiguration('commentary');
  const currentTheme = config.get<string>('theme.name', 'simple');

  try {
    // Check if themes directory exists
    const themesDirPath = themesDir.fsPath;
    if (!fs.existsSync(themesDirPath)) {
      console.error('[Commentary] Themes directory not found:', themesDirPath);
      vscode.window.showWarningMessage(
        'Commentary: Theme files not found. Please rebuild the extension with "npm run compile".',
        'Open Terminal'
      ).then((action) => {
        if (action === 'Open Terminal') {
          const terminal = vscode.window.createTerminal('Commentary Build');
          terminal.sendText('npm run compile');
          terminal.show();
        }
      });
      return;
    }

    // Check if current theme file exists
    const currentThemeFile = path.join(themesDirPath, `${currentTheme}.css`);
    if (!fs.existsSync(currentThemeFile)) {
      console.warn('[Commentary] Current theme file not found:', currentThemeFile);
      // List available themes
      const availableThemes = fs.readdirSync(themesDirPath)
        .filter(f => f.endsWith('.css'))
        .map(f => f.replace('.css', ''));

      if (availableThemes.length === 0) {
        vscode.window.showWarningMessage(
          `Commentary: No theme files found. Please rebuild with "npm run compile".`
        );
      } else {
        console.log('[Commentary] Available themes:', availableThemes);
        vscode.window.showWarningMessage(
          `Commentary: Theme "${currentTheme}" not found. Available themes: ${availableThemes.join(', ')}`
        );
      }
    } else {
      console.log(`[Commentary] Theme validated: ${currentTheme}`);
    }
  } catch (error) {
    console.error('[Commentary] Theme validation error:', error);
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Prevent concurrent activation
  if (isActivating) {
    console.warn('[Commentary] Activation already in progress, skipping');
    return;
  }
  
  // Check if already activated (hot reload scenario)
  if (commentsTreeView) {
    console.warn('[Commentary] Extension already activated, calling deactivate first');
    deactivate();
  }
  
  isActivating = true;
  console.log('[Commentary] Extension activating from:', context.extensionPath);
  
  try {
    activateInternal(context);
  } finally {
    isActivating = false;
  }
}

function activateInternal(context: vscode.ExtensionContext) {
  console.log('[Commentary] Extension is now active');

  // Initialize storage
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  storageManager = new StorageManager(context, workspaceRoot);

  // Set initial agent provider context key (for conditional UI)
  const updateProviderContext = () => {
    const agentConfig = vscode.workspace.getConfiguration('commentary.agent');
    const provider = agentConfig.get<string>('provider', 'cursor');
    vscode.commands.executeCommand('setContext', 'commentary.agentProvider', provider);
    console.log('[Extension] Set commentary.agentProvider context to:', provider);

    // Set Cursor CLI availability context (no default value = must be explicitly configured)
    const cursorCliPath = agentConfig.get<string>('cursorCliPath');
    const hasCursorCli = !!(cursorCliPath && cursorCliPath.trim().length > 0);
    vscode.commands.executeCommand('setContext', 'commentary.hasCursorCli', hasCursorCli);
    console.log('[Extension] Set commentary.hasCursorCli context to:', hasCursorCli);
  };

  // Smart provider detection (async, non-blocking)
  detectOptimalProvider().then(async (detection) => {
    console.log('[Commentary] Provider detection result:', detection);

    const agentConfig = vscode.workspace.getConfiguration('commentary.agent');
    const currentProvider = agentConfig.inspect<string>('provider');

    // Only auto-configure if user hasn't explicitly set a provider
    if (!currentProvider?.workspaceValue && !currentProvider?.globalValue) {
      // Set the detected provider as global setting (can be overridden per-workspace)
      await agentConfig.update('provider', detection.provider, vscode.ConfigurationTarget.Global);
      console.log('[Commentary] Auto-configured provider:', detection.provider, '-', detection.reason);

      // Show notification about detection (dismissible, non-intrusive)
      const message = getProviderSetupMessage(detection);
      if (detection.capabilities.requiresClipboard) {
        // Show more prominent message if falling back to clipboard
        const action = await vscode.window.showInformationMessage(
          message,
          'Configure Agent',
          'Dismiss'
        );
        if (action === 'Configure Agent') {
          await vscode.commands.executeCommand('commentary.configureAgent');
        }
      } else {
        // Just log success for CLI/API methods
        console.log('[Commentary]', message);
      }
    }

    // Update context key
    updateProviderContext();
  }).catch((error) => {
    console.error('[Commentary] Provider detection failed:', error);
    // Fallback to manual context update
    updateProviderContext();
  });

  // Listen for provider configuration changes and update context
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('commentary.agent.provider') ||
          e.affectsConfiguration('commentary.agent.cursorCliPath')) {
        updateProviderContext();
      }
    })
  );

  // Validate theme files exist (non-blocking)
  validateThemeFiles(context).catch((error) => {
    console.error('[Commentary] Theme validation failed:', error);
  });

  // Initialize overlay host
  overlayHost = new OverlayHost(context, storageManager);

  // Initialize markdown webview provider with overlay host
  markdownWebviewProvider = new MarkdownWebviewProvider(context, storageManager, overlayHost);

  // Register custom editor provider for markdown files
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'commentary.markdownEditor',
      markdownWebviewProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );

  // Initialize agent client
  const agentClient = new AgentClient(context);

  // Initialize comments view provider early (needed for commands below)
  commentsViewProvider = new CommentsViewProvider(storageManager, markdownWebviewProvider);
  commentsTreeView = vscode.window.createTreeView('commentary.commentsView', {
    treeDataProvider: commentsViewProvider,
  });
  commentsViewProvider.setTreeView(commentsTreeView);
  context.subscriptions.push(commentsTreeView);

  // Register command to open markdown in Commentary view
  context.subscriptions.push(
    vscode.commands.registerCommand('commentary.openPreview', async (uri?: vscode.Uri, allUris?: vscode.Uri[]) => {
      // If called from explorer context menu with file URI(s)
      if (uri) {
        const urisToOpen = allUris && allUris.length > 0 ? allUris : [uri];

        for (const fileUri of urisToOpen) {
          try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            if (document.languageId === 'markdown') {
              await markdownWebviewProvider?.openMarkdown(document);
            }
          } catch (error) {
            console.error('Failed to open file:', error);
          }
        }

        // Auto-reveal Comments sidebar - just show the view
        if (commentsTreeView && commentsTreeView.visible) {
          // View is already visible
        } else {
          // Try to show the view container
          await vscode.commands.executeCommand('workbench.view.extension.commentary-sidebar');
        }
        return;
      }

      // If called without URI, use active editor
      const editor = vscode.window.activeTextEditor;

      // Check active editor first
      if (editor && editor.document.languageId === 'markdown') {
        await markdownWebviewProvider?.openMarkdown(editor.document);
        // Auto-reveal Comments sidebar - just show the view
        if (commentsTreeView && commentsTreeView.visible) {
          // View is already visible
        } else {
          // Try to show the view container
          await vscode.commands.executeCommand('workbench.view.extension.commentary-sidebar');
        }
        return;
      }

      // Check visible editors
      const markdownEditor = vscode.window.visibleTextEditors.find(
        (e) => e.document.languageId === 'markdown'
      );

      if (markdownEditor) {
        await markdownWebviewProvider?.openMarkdown(markdownEditor.document);
        // Auto-reveal Comments sidebar - just show the view
        if (commentsTreeView && commentsTreeView.visible) {
          // View is already visible
        } else {
          // Try to show the view container
          await vscode.commands.executeCommand('workbench.view.extension.commentary-sidebar');
        }
        return;
      }

      // Check all open text documents
      const markdownDoc = vscode.workspace.textDocuments.find(
        (doc) => doc.languageId === 'markdown'
      );

      if (markdownDoc) {
        await markdownWebviewProvider?.openMarkdown(markdownDoc);
        // Auto-reveal Comments sidebar - just show the view
        if (commentsTreeView && commentsTreeView.visible) {
          // View is already visible
        } else {
          // Try to show the view container
          await vscode.commands.executeCommand('workbench.view.extension.commentary-sidebar');
        }
        return;
      }

      vscode.window.showWarningMessage('Please open a Markdown file first');
    })
  );

  // Register command to show Comments sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand('commentary.showCommentsSidebar', async () => {
      // Show the view container
      await vscode.commands.executeCommand('workbench.view.extension.commentary-sidebar');
    })
  );

  // Trigger initial refresh to load existing comments
  commentsViewProvider.refresh();

  // Initialize file decoration provider for Explorer badges
  fileDecorationProvider = new CommentaryFileDecorationProvider(storageManager);
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(fileDecorationProvider)
  );

  // Refresh view and decorations when notes change
  overlayHost.onNotesChanged((event) => {
    console.log('[Extension] onNotesChanged fired - refreshing sidebar and decorations');
    commentsViewProvider?.refresh(event);
    fileDecorationProvider?.refresh();
    console.log('[Extension] Sidebar and decorations refresh called');
  });

  // Initialize command manager
  const commandManager = new CommandManager(
    context,
    storageManager,
    overlayHost,
    commentsViewProvider,
    agentClient,
    markdownWebviewProvider,
    fileDecorationProvider
  );
  commandManager.registerCommands();

  // Watch for active editor changes to refresh preview
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      try {
        if (editor && editor.document.languageId === 'markdown') {
          await overlayHost?.refreshPreview();
          commentsViewProvider?.refresh();
        }
      } catch (error) {
        console.error('[Commentary] Error in onDidChangeActiveTextEditor:', error);
      }
    })
  );

  // Watch for document changes to refresh preview
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      try {
        if (event.document.languageId === 'markdown') {
          // Clear previous timer
          if (documentChangeTimer) {
            clearTimeout(documentChangeTimer);
          }
          // Debounce: refresh after 300ms of inactivity
          documentChangeTimer = setTimeout(async () => {
            await overlayHost?.refreshPreview();
            // Also refresh webview content to show external changes (e.g., from cursor-agent)
            await markdownWebviewProvider?.refreshWebviewForDocument(event.document);
          }, 300);
        }
      } catch (error) {
        console.error('[Commentary] Error in onDidChangeTextDocument:', error);
      }
    })
  );

  // Register markdown preview extension API consumer
  // This allows us to inject scripts and styles into the preview
  return {
    extendMarkdownIt(md: Record<string, unknown>): Record<string, unknown> {
      // We don't need to modify markdown-it itself
      // We rely on preview scripts and styles injection
      return md;
    },
    // Export context for testing
    context,
  };
}

export function deactivate() {
  console.log('[Commentary] Extension deactivating...');
  
  isActivating = false;
  
  // Dispose all resources in reverse order
  if (commentsTreeView) {
    try {
      commentsTreeView.dispose();
    } catch (e) {
      console.warn('[Commentary] Error disposing tree view:', e);
    }
    commentsTreeView = undefined;
  }
  
  if (commentsViewProvider) {
    try {
      commentsViewProvider.dispose();
    } catch (e) {
      console.warn('[Commentary] Error disposing comments view provider:', e);
    }
    commentsViewProvider = undefined;
  }

  if (overlayHost) {
    try {
      overlayHost.dispose();
    } catch (e) {
      console.warn('[Commentary] Error disposing overlay host:', e);
    }
    overlayHost = undefined;
  }

  if (markdownWebviewProvider) {
    // MarkdownWebviewProvider doesn't have dispose, but panels are managed by it
    markdownWebviewProvider = undefined;
  }

  if (fileDecorationProvider) {
    try {
      fileDecorationProvider.dispose();
    } catch (e) {
      console.warn('[Commentary] Error disposing file decoration provider:', e);
    }
    fileDecorationProvider = undefined;
  }
  
  // Clear document change timer
  if (documentChangeTimer) {
    clearTimeout(documentChangeTimer);
    documentChangeTimer = undefined;
  }
  
  storageManager = undefined;
  
  console.log('[Commentary] Extension deactivated');
}
