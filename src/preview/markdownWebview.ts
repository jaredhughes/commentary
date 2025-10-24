/**
 * Custom webview for rendering markdown with Commentary overlay
 */

import * as vscode from 'vscode';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import markdownItTaskLists from 'markdown-it-task-lists';
import hljs from 'highlight.js';
import { StorageManager } from '../storage';
import { OverlayHost } from './overlayHost';
import { PreviewMessage } from '../types';

export class MarkdownWebviewProvider implements vscode.CustomTextEditorProvider {
  private panels: Map<string, vscode.WebviewPanel> = new Map();
  private md: MarkdownIt;
  private activeDocumentUri: string | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private storage: StorageManager,
    private overlayHost: OverlayHost
  ) {
    // Configure markdown-it with GitHub-flavored markdown and syntax highlighting
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      breaks: true,
      highlight: (str, lang) => {
        // If language is specified and supported, use highlight.js
        if (lang && hljs.getLanguage(lang)) {
          try {
            return '<pre class="hljs"><code>' +
              hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
              '</code></pre>';
          } catch (err) {
            console.error('Highlight.js error:', err);
          }
        }
        // No language specified or not supported - use plain text
        return '<pre class="hljs"><code>' + this.md.utils.escapeHtml(str) + '</code></pre>';
      }
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

    // Track this as the active document
    this.activeDocumentUri = uri;

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

    // Track when this panel becomes visible
    webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.visible) {
        this.activeDocumentUri = uri;
      }
    });

    // Clean up when panel is closed
    webviewPanel.onDidDispose(
      () => {
        this.panels.delete(uri);
        if (this.activeDocumentUri === uri) {
          this.activeDocumentUri = undefined;
        }
      },
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
   * Refresh all open webviews (e.g., when theme changes)
   */
  async refreshAllWebviews(): Promise<void> {
    console.log('[MarkdownWebviewProvider] Refreshing all webviews');
    for (const [uriString, panel] of this.panels.entries()) {
      try {
        const uri = vscode.Uri.parse(uriString);
        const document = await vscode.workspace.openTextDocument(uri);
        this.updateContent(panel, document);
      } catch (error) {
        console.error(`Failed to refresh webview for ${uriString}:`, error);
      }
    }
  }

  /**
   * Get the URI of the currently active Commentary document
   */
  getActiveDocumentUri(): string | undefined {
    return this.activeDocumentUri;
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

    // Determine if theme is dark for syntax highlighting
    // Simple theme looks better with dark syntax highlighting
    const isDarkTheme = themeName.includes('dark') || themeName === 'sakura-vader' || themeName === 'simple';
    const highlightTheme = isDarkTheme ? 'highlight-dark.css' : 'highlight-light.css';
    const highlightUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', highlightTheme)
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

  <!-- Minimal reset + base styles -->
  <style nonce="${nonce}">
    /* Minimal reset - let themes control typography and spacing */
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
    }

    /* Layout rules - balanced padding with top-right button */
    body {
      padding: 72px 32px 32px 32px;
    }
    #markdown-content {
      max-width: 900px;
      width: 100%;
      margin: 0 auto;
    }

    @media (max-width: 768px) {
      body { padding: 64px 20px 20px 20px; }
    }
    @media (max-width: 480px) {
      body { padding: 56px 12px 12px 12px; }
    }
  </style>

  <!-- Theme CSS (loads after base styles to take priority) -->
  <link rel="stylesheet" href="${themeUri}">

  <!-- Syntax Highlighting CSS -->
  <link rel="stylesheet" href="${highlightUri}">

  <!-- Overlay CSS -->
  <link rel="stylesheet" href="${overlayStyleUri}">
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

      // Store agent provider for dynamic UI
      window.commentaryAgentProvider = '${config.get<string>('agent.provider', 'cursor')}';
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
