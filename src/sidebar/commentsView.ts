/**
 * Sidebar tree view for displaying comments
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { StorageManager } from '../storage';
import { Note } from '../types';
import { MarkdownWebviewProvider } from '../preview/markdownWebview';

export class CommentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly note: Note,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    // Use larger label for better visibility
    super(note.text, collapsibleState);

    this.tooltip = this.buildTooltip();
    this.description = this.buildDescription();

    // Different contextValue and icon for document-level comments
    if (note.isDocumentLevel) {
      this.contextValue = 'documentComment';
      this.iconPath = new vscode.ThemeIcon('note', new vscode.ThemeColor('charts.blue'));
    } else {
      this.contextValue = 'comment';
      this.iconPath = new vscode.ThemeIcon('comment', new vscode.ThemeColor('charts.yellow'));

      // Make clickable to reveal in preview
      this.command = {
        command: 'commentary.revealComment',
        title: 'Reveal Comment',
        arguments: [note.id],
      };
    }
  }

  private buildDescription(): string {
    if (this.note.isDocumentLevel) {
      return '📄 Entire document';
    }
    if (this.note.lines) {
      return `L${this.note.lines.start}–${this.note.lines.end}`;
    }
    return `Pos ${this.note.position.start}–${this.note.position.end}`;
  }

  private buildTooltip(): string {
    if (this.note.isDocumentLevel) {
      return [
        `Comment: ${this.note.text}`,
        '',
        'Scope: Entire document',
        `Created: ${new Date(this.note.createdAt).toLocaleString()}`,
        '',
        'Click edit icon to modify'
      ].join('\n');
    }

    const lines = [`Comment: ${this.note.text}`, '', `Selected: "${this.note.quote.exact}"`];

    if (this.note.lines) {
      lines.push(`Lines: ${this.note.lines.start}–${this.note.lines.end}`);
    }

    lines.push(`Created: ${new Date(this.note.createdAt).toLocaleString()}`);
    lines.push('', 'Click to reveal in preview, or use edit icon to modify');

    return lines.join('\n');
  }
}

export class FileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly fileUri: string,
    public readonly noteCount: number,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(formatFilePathForDisplay(fileUri), collapsibleState);

    this.tooltip = `${noteCount} comment(s)`;
    this.description = `${noteCount} comment(s)`;
    this.contextValue = 'file';
    this.iconPath = new vscode.ThemeIcon('file');
  }
}

/**
 * Format file path for display - converts to ~/relative path if possible
 */
function formatFilePathForDisplay(fileUri: string): string {
  try {
    // Parse the file:// URI to get the absolute path
    const uri = vscode.Uri.parse(fileUri);
    let filePath = uri.fsPath;

    // Try to make it relative to home directory
    const homeDir = os.homedir();
    if (filePath.startsWith(homeDir)) {
      filePath = '~' + filePath.substring(homeDir.length);
    }

    // If it's in a workspace, try to make it workspace-relative
    const workspaceRelative = vscode.workspace.asRelativePath(uri, false);
    if (workspaceRelative !== uri.fsPath && workspaceRelative.length < filePath.length) {
      return workspaceRelative;
    }

    return filePath;
  } catch (error) {
    // Fallback to the URI as-is
    return fileUri;
  }
}

export class CommentsViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private storage: StorageManager,
    private webviewProvider: MarkdownWebviewProvider
  ) {}

  refresh(): void {
    console.log('[CommentsView] refresh() called');
    this._onDidChangeTreeData.fire();
    console.log('[CommentsView] _onDidChangeTreeData fired');
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    console.log('[CommentsView] getTreeItem called');
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    console.log('[CommentsView] getChildren called, element:', element);
    if (!element) {
      // Root level: show files with comments
      const items = await this.getFileItems();
      console.log('[CommentsView] Returning file items:', items.length);
      return items;
    }

    if (element instanceof FileTreeItem) {
      // Show comments for this file
      const items = await this.getCommentItems(element.fileUri);
      console.log('[CommentsView] Returning comment items for file:', items.length);
      return items;
    }

    return [];
  }

  private async getFileItems(): Promise<FileTreeItem[]> {
    console.log('[CommentsView] getFileItems called');
    const allNotes = await this.storage.getAllNotes();
    console.log('[CommentsView] getAllNotes returned:', allNotes.size, 'files');
    const items: FileTreeItem[] = [];

    for (const [fileUri, notes] of allNotes.entries()) {
      console.log('[CommentsView] File:', fileUri, 'has', notes.length, 'notes');
      if (notes.length > 0) {
        items.push(
          new FileTreeItem(fileUri, notes.length, vscode.TreeItemCollapsibleState.Expanded)
        );
      }
    }

    console.log('[CommentsView] Returning', items.length, 'file items');
    return items;
  }

  private async getCommentItems(fileUri: string): Promise<CommentTreeItem[]> {
    console.log('[CommentsView] getCommentItems called for:', fileUri);
    const notes = await this.storage.getNotes(fileUri);
    console.log('[CommentsView] Got', notes.length, 'notes');

    // Sort by position
    notes.sort((a, b) => a.position.start - b.position.start);

    return notes.map(
      (note) => new CommentTreeItem(note, vscode.TreeItemCollapsibleState.None)
    );
  }

  /**
   * Get all comments for the active editor
   * Prioritizes Commentary preview if open, otherwise falls back to active text editor
   */
  async getActiveFileComments(): Promise<Note[]> {
    // First check if there's an active Commentary document
    const activeCommentaryUri = this.webviewProvider.getActiveDocumentUri();
    if (activeCommentaryUri) {
      return this.storage.getNotes(activeCommentaryUri);
    }

    // Fall back to checking active text editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.languageId === 'markdown') {
      return this.storage.getNotes(activeEditor.document.uri.toString());
    }

    // If active editor isn't markdown, search through all visible editors
    const markdownEditor = vscode.window.visibleTextEditors.find(
      (editor) => editor.document.languageId === 'markdown'
    );

    if (markdownEditor) {
      return this.storage.getNotes(markdownEditor.document.uri.toString());
    }

    return [];
  }
}
