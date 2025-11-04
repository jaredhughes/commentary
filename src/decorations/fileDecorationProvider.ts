/**
 * File decoration provider to show comment indicators in Explorer
 */

import * as vscode from 'vscode';
import { StorageManager } from '../storage';

export class CommentaryFileDecorationProvider implements vscode.FileDecorationProvider {
  private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  constructor(private storage: StorageManager) {}

  /**
   * Refresh decorations (call when comments change)
   */
  async refresh(uri?: vscode.Uri): Promise<void> {
    if (uri) {
      this._onDidChangeFileDecorations.fire(uri);
    } else {
      // Refresh all markdown files in workspace
      const markdownFiles = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
      this._onDidChangeFileDecorations.fire(markdownFiles);
    }
  }

  /**
   * Provide decoration for a file
   */
  async provideFileDecoration(
    uri: vscode.Uri,
    _token: vscode.CancellationToken
  ): Promise<vscode.FileDecoration | undefined> {
    // Only decorate markdown files
    if (!uri.fsPath.endsWith('.md')) {
      return undefined;
    }

    // Get comment count for this file
    const notes = await this.storage.getNotes(uri.toString());

    if (notes.length === 0) {
      return undefined;
    }

    // Return decoration with comment count badge
    return {
      badge: notes.length.toString(),
      tooltip: `${notes.length} comment${notes.length === 1 ? '' : 's'}`,
      color: new vscode.ThemeColor('charts.yellow'),
    };
  }

  dispose(): void {
    this._onDidChangeFileDecorations.dispose();
  }
}
