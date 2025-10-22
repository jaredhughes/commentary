/**
 * Custom webview for rendering markdown with Commentary overlay
 */

import * as vscode from 'vscode';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import markdownItTaskLists from 'markdown-it-task-lists';
import { StorageManager } from '../storage';
import { OverlayHost } from './overlayHost';
import { PreviewMessage } from '../types';

export class MarkdownWebviewProvider implements vscode.CustomTextEditorProvider {
  private panels: Map<string, vscode.WebviewPanel> = new Map();
  private md: MarkdownIt;

  constructor(
    private context: vscode.ExtensionContext,
    private storage: StorageManager,
    private overlayHost: OverlayHost
  ) {
    // Configure markdown-it with GitHub-flavored markdown
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      breaks: true,
    })
      .use(markdownItAnchor, {
        permalink: markdownItAnchor.permalink.headerLink(),
      })
      .use(markdownItTaskLists, {
        enabled: true,
        label: true,
      });
  }

  /**
   * Called when a custom editor is opened (part of CustomTextEditorProvider interface)
   */
  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const uri = document.uri.toString();

    // Configure webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      ],
    };

    this.panels.set(uri, webviewPanel);

    // Set initial content
    this.updateContent(webviewPanel, document);

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message, document, webviewPanel),
      null,
      this.context.subscriptions
    );

    // Register panel with overlay host for sending messages back
    this.overlayHost.registerWebview(webviewPanel, document.uri.toString());

    // Clean up when panel is closed
    webviewPanel.onDidDispose(
      () => this.panels.delete(uri),
      null,
      this.context.subscriptions
    );

    // Watch for document changes with debouncing (300ms)
    let updateTimer: NodeJS.Timeout | undefined;
    const changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document === document) {
        // Clear previous timer
        if (updateTimer) {
          clearTimeout(updateTimer);
        }
        // Debounce updates to avoid re-rendering on every keystroke
        updateTimer = setTimeout(() => {
          this.updateContent(webviewPanel, document);
        }, 300);
      }
    });

    webviewPanel.onDidDispose(() => {
      if (updateTimer) {
        clearTimeout(updateTimer);
      }
      changeDisposable.dispose();
    });

    // Auto-reveal Comments sidebar (non-blocking - fire and forget)
    vscode.commands.executeCommand('commentary.commentsView.focus');
  }

  /**
   * Open or reveal markdown file in Commentary webview
   */
  async openMarkdown(document: vscode.TextDocument): Promise<void> {
    const uri = document.uri.toString();

    // Check if panel already exists
    const existingPanel = this.panels.get(uri);
    if (existingPanel) {
      existingPanel.reveal();
      this.updateContent(existingPanel, document);
      return;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'commentaryMarkdown',
      `📝 ${path.basename(document.fileName)}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        ],
      }
    );

    this.panels.set(uri, panel);

    // Set initial content
    this.updateContent(panel, document);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message, document, panel),
      null,
      this.context.subscriptions
    );

    // Register panel with overlay host for sending messages back
    this.overlayHost.registerWebview(panel, document.uri.toString());

    // Clean up when panel is closed
    panel.onDidDispose(
      () => this.panels.delete(uri),
      null,
      this.context.subscriptions
    );

    // Watch for document changes with debouncing (300ms)
    let updateTimer: NodeJS.Timeout | undefined;
    const changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document === document) {
        // Clear previous timer
        if (updateTimer) {
          clearTimeout(updateTimer);
        }
        // Debounce updates to avoid re-rendering on every keystroke
        updateTimer = setTimeout(() => {
          this.updateContent(panel, document);
        }, 300);
      }
    });

    panel.onDidDispose(() => {
      if (updateTimer) {
        clearTimeout(updateTimer);
      }
      changeDisposable.dispose();
    });
  }

  /**
   * Update webview content
   */
  private updateContent(panel: vscode.WebviewPanel, document: vscode.TextDocument): void {
    const markdownContent = document.getText();
    const htmlContent = this.md.render(markdownContent);

    panel.webview.html = this.getHtmlForWebview(panel.webview, htmlContent, document);
  }

  /**
   * Generate HTML for webview
   */
  private getHtmlForWebview(
    webview: vscode.Webview,
    htmlContent: string,
    document: vscode.TextDocument
  ): string {
    // Get URIs for scripts and styles
    const overlayScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'overlay.js')
    );
    const overlayStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'overlay.css')
    );

    // Get theme CSS
    const config = vscode.workspace.getConfiguration('commentary');
    const themeName = config.get<string>('theme.name', 'github-light');
    const themeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'themes', `${themeName}.css`)
    );

    // Generate nonce for security
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <title>Commentary</title>

  <!-- Theme CSS -->
  <link rel="stylesheet" href="${themeUri}">

  <!-- Overlay CSS -->
  <link rel="stylesheet" href="${overlayStyleUri}">

  <style nonce="${nonce}">
    * {
      box-sizing: border-box;
    }
    html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow-y: scroll;
    }
    body {
      margin: 0;
      padding: 32px;
      width: 100%;
      min-height: 100vh;
    }
    #markdown-content {
      max-width: 900px;
      margin: 0 auto;
      width: 100%;
    }
    /* Responsive padding */
    @media (max-width: 768px) {
      body {
        padding: 20px;
      }
    }
    @media (max-width: 480px) {
      body {
        padding: 16px;
      }
    }
  </style>
</head>
<body>
  <div id="markdown-content">
    ${htmlContent}
  </div>

  <!-- Overlay Script -->
  <script nonce="${nonce}" src="${overlayScriptUri}"></script>

  <!-- Webview Adapter -->
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();

      // Override postMessage in overlay.js to send to extension
      window.commentaryPostMessage = function(message) {
        vscode.postMessage(message);
      };

      // Store document URI for context
      window.commentaryDocumentUri = '${document.uri.toString()}';
    })();
  </script>
</body>
</html>`;
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: PreviewMessage, document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    console.log('Webview received message:', message);
    // Handle the message directly through overlayHost
    await this.overlayHost.handlePreviewMessage(message, document.uri.toString(), panel);
  }

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Dispose all panels
   */
  dispose(): void {
    for (const panel of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
  }
}
