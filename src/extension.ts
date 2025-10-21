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

let overlayHost: OverlayHost | undefined;
let storageManager: StorageManager | undefined;
let commentsViewProvider: CommentsViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Commentary extension is now active');

  // Initialize storage
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  storageManager = new StorageManager(context, workspaceRoot);

  // Initialize overlay host
  overlayHost = new OverlayHost(context, storageManager);

  // Initialize agent client
  const agentClient = new AgentClient(context);

  // Initialize comments view provider
  commentsViewProvider = new CommentsViewProvider(storageManager);
  const treeView = vscode.window.createTreeView('commentary.commentsView', {
    treeDataProvider: commentsViewProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView);

  // Refresh view when notes change
  overlayHost.onNotesChanged(() => {
    commentsViewProvider?.refresh();
  });

  // Initialize command manager
  const commandManager = new CommandManager(
    context,
    storageManager,
    overlayHost,
    commentsViewProvider,
    agentClient
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
    extendMarkdownIt(md: any) {
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
