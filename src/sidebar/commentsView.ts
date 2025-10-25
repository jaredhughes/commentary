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
    }

    // Make clickable to edit (works for both regular and document-level comments)
    this.command = {
      command: 'commentary.editCommentFromSidebar',
      title: 'Edit Comment',
      arguments: [this],
    };
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
        'Click to edit'
      ].join('\n');
    }

    const lines = [`Comment: ${this.note.text}`, '', `Selected: "${this.note.quote.exact}"`];

    if (this.note.lines) {
      lines.push(`Lines: ${this.note.lines.start}–${this.note.lines.end}`);
    }

    lines.push(`Created: ${new Date(this.note.createdAt).toLocaleString()}`);
    lines.push('', 'Click to edit');

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

    // Update tooltip and description based on comment count
    if (noteCount === 0) {
      this.tooltip = 'No comments yet';
      this.description = '';
      this.iconPath = new vscode.ThemeIcon('file', new vscode.ThemeColor('disabledForeground'));
    } else {
      this.tooltip = `${noteCount} comment${noteCount === 1 ? '' : 's'}`;
      this.description = `${noteCount} comment${noteCount === 1 ? '' : 's'}`;
      this.iconPath = new vscode.ThemeIcon('file');
    }

    this.contextValue = 'file';

    // Make clickable to open/focus document
    this.command = {
      command: 'commentary.openDocument',
      title: 'Open Document',
      arguments: [fileUri],
    };
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

    // Update context for button visibility (fire and forget)
    this.updateContext();
  }

  private async updateContext(): Promise<void> {
    const allNotes = await this.storage.getAllNotes();
    const hasComments = Array.from(allNotes.values()).some(notes => notes.length > 0);
    await vscode.commands.executeCommand('setContext', 'commentary.hasComments', hasComments);
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
    const items: FileTreeItem[] = [];

    // Find all markdown files in workspace
    const workspaceFiles = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
    console.log('[CommentsView] Found', workspaceFiles.length, 'markdown files in workspace');

    // Get all notes to check which files have comments
    const allNotes = await this.storage.getAllNotes();
    console.log('[CommentsView] getAllNotes returned:', allNotes.size, 'files with notes');

    // Create a map of file URIs to comment counts
    const fileCommentCounts = new Map<string, number>();
    for (const [fileUri, notes] of allNotes.entries()) {
      fileCommentCounts.set(fileUri, notes.length);
    }

    // Create items for all markdown files
    for (const fileUri of workspaceFiles) {
      const uriString = fileUri.toString();
      const commentCount = fileCommentCounts.get(uriString) || 0;

      // Files with comments are expanded, files without are collapsed
      const collapsibleState = commentCount > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None;

      items.push(new FileTreeItem(uriString, commentCount, collapsibleState));
    }

    // Sort: files with comments first, then alphabetically
    items.sort((a, b) => {
      if (a.noteCount > 0 && b.noteCount === 0) return -1;
      if (a.noteCount === 0 && b.noteCount > 0) return 1;
      return a.label!.toString().localeCompare(b.label!.toString());
    });

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
