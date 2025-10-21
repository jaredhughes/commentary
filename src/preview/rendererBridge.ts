/**
 * Helper utilities for preview rendering and message passing
 */

import * as vscode from 'vscode';

export class RendererBridge {
  /**
   * Get the script URIs for injection into markdown preview
   */
  static getPreviewScripts(extensionUri: vscode.Uri): vscode.Uri[] {
    return [vscode.Uri.joinPath(extensionUri, 'media', 'overlay.js')];
  }

  /**
   * Get the stylesheet URIs for injection into markdown preview
   */
  static getPreviewStyles(extensionUri: vscode.Uri): vscode.Uri[] {
    return [vscode.Uri.joinPath(extensionUri, 'media', 'overlay.css')];
  }

  /**
   * Get theme stylesheet based on configuration
   */
  static getThemeStylesheet(extensionUri: vscode.Uri): vscode.Uri | undefined {
    const config = vscode.workspace.getConfiguration('commentary');
    const themeName = config.get<string>('theme.name', 'github-light');
    const customCssPath = config.get<string>('theme.customCssPath', '');

    if (customCssPath) {
      const useCustomFirst = config.get<boolean>('theme.useCustomFirst', false);
      if (useCustomFirst) {
        // Return custom CSS path (absolute or workspace-relative)
        if (vscode.workspace.workspaceFolders && !customCssPath.startsWith('/')) {
          return vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders[0].uri,
            customCssPath
          );
        }
        return vscode.Uri.file(customCssPath);
      }
    }

    // Return built-in theme
    return vscode.Uri.joinPath(extensionUri, 'media', 'themes', `${themeName}.css`);
  }

  /**
   * Convert a webview message to preview message protocol
   */
  static parseMessage(message: any): any {
    // Basic validation and parsing
    if (!message || typeof message !== 'object') {
      throw new Error('Invalid message format');
    }

    return message;
  }
}
