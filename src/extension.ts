/**
 * Commentary Extension - Main entry point
 * Google Docs-style commenting for rendered Markdown in VS Code
 */

import * as vscode from 'vscode';
import { StorageManager } from './storage';
import { OverlayHost } from './preview/overlayHost';
import { CommentsViewProvider } from './sidebar/commentsView';
import { CommandManager } from './sidebar/commands';
import { AgentClient } from './agent/client';
import { MarkdownWebviewProvider } from './preview/markdownWebview';
import { CommentaryFileDecorationProvider } from './decorations/fileDecorationProvider';

let overlayHost: OverlayHost | undefined;
let storageManager: StorageManager | undefined;
let commentsViewProvider: CommentsViewProvider | undefined;
let markdownWebviewProvider: MarkdownWebviewProvider | undefined;
let fileDecorationProvider: CommentaryFileDecorationProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Commentary extension is now active');

  // Set default theme based on system color scheme (only if not already configured)
  const config = vscode.workspace.getConfiguration('commentary.theme');
  const currentTheme = config.inspect<string>('name');

  // Only set default if user hasn't explicitly configured a theme
  if (!currentTheme?.workspaceValue && !currentTheme?.globalValue) {
    const colorTheme = vscode.window.activeColorTheme;
    const defaultTheme = colorTheme.kind === vscode.ColorThemeKind.Dark
      ? 'github-dark'
      : 'github-light';

    console.log(`Setting default theme based on color scheme: ${defaultTheme}`);
    // Set as workspace value so it's not persisted globally
    config.update('name', defaultTheme, vscode.ConfigurationTarget.Workspace);
  }

  // Initialize storage
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  storageManager = new StorageManager(context, workspaceRoot);

  // Set initial agent provider context key (for conditional UI)
  const updateProviderContext = () => {
    const agentConfig = vscode.workspace.getConfiguration('commentary.agent');
    const provider = agentConfig.get<string>('provider', 'cursor');
    vscode.commands.executeCommand('setContext', 'commentary.agentProvider', provider);
    console.log('[Extension] Set commentary.agentProvider context to:', provider);
  };
  updateProviderContext();

  // Listen for provider configuration changes and update context
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('commentary.agent.provider')) {
        updateProviderContext();
      }
    })
  );

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

        // Auto-reveal Comments sidebar
        await vscode.commands.executeCommand('commentary.commentsView.focus');
        return;
      }

      // If called without URI, use active editor
      const editor = vscode.window.activeTextEditor;

      // Check active editor first
      if (editor && editor.document.languageId === 'markdown') {
        await markdownWebviewProvider?.openMarkdown(editor.document);
        // Auto-reveal Comments sidebar
        await vscode.commands.executeCommand('commentary.commentsView.focus');
        return;
      }

      // Check visible editors
      const markdownEditor = vscode.window.visibleTextEditors.find(
        (e) => e.document.languageId === 'markdown'
      );

      if (markdownEditor) {
        await markdownWebviewProvider?.openMarkdown(markdownEditor.document);
        // Auto-reveal Comments sidebar
        await vscode.commands.executeCommand('commentary.commentsView.focus');
        return;
      }

      // Check all open text documents
      const markdownDoc = vscode.workspace.textDocuments.find(
        (doc) => doc.languageId === 'markdown'
      );

      if (markdownDoc) {
        await markdownWebviewProvider?.openMarkdown(markdownDoc);
        // Auto-reveal Comments sidebar
        await vscode.commands.executeCommand('commentary.commentsView.focus');
        return;
      }

      vscode.window.showWarningMessage('Please open a Markdown file first');
    })
  );

  // Register command to show Comments sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand('commentary.showCommentsSidebar', async () => {
      await vscode.commands.executeCommand('commentary.commentsView.focus');
    })
  );

  // Initialize comments view provider
  commentsViewProvider = new CommentsViewProvider(storageManager, markdownWebviewProvider);
  const treeView = vscode.window.createTreeView('commentary.commentsView', {
    treeDataProvider: commentsViewProvider,
  });

  context.subscriptions.push(treeView);

  // Trigger initial refresh to load existing comments
  commentsViewProvider.refresh();

  // Initialize file decoration provider for Explorer badges
  fileDecorationProvider = new CommentaryFileDecorationProvider(storageManager);
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(fileDecorationProvider)
  );

  // Refresh view and decorations when notes change
  overlayHost.onNotesChanged(() => {
    console.log('[Extension] onNotesChanged fired - refreshing sidebar and decorations');
    commentsViewProvider?.refresh();
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
    markdownWebviewProvider
  );
  commandManager.registerCommands();

  // Watch for active editor changes to refresh preview
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor && editor.document.languageId === 'markdown') {
        await overlayHost?.refreshPreview();
        commentsViewProvider?.refresh();
      }
    })
  );

  // Watch for document changes to refresh preview
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (event.document.languageId === 'markdown') {
        // Debounce: only refresh after 500ms of inactivity
        // (In a real implementation, use a proper debounce)
        await overlayHost?.refreshPreview();
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
  };
}

export function deactivate() {
  overlayHost?.dispose();
  console.log('Commentary extension deactivated');
}
