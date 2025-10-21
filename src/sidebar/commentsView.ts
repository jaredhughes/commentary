/**
 * Sidebar tree view for displaying comments
 */

import * as vscode from 'vscode';
import { StorageManager } from '../storage';
import { Note } from '../types';

export class CommentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly note: Note,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(note.text, collapsibleState);

    this.tooltip = this.buildTooltip();
    this.description = this.buildDescription();
    this.contextValue = 'comment';
    this.iconPath = new vscode.ThemeIcon('comment');

    // Make clickable to reveal in preview
    this.command = {
      command: 'commentary.revealComment',
      title: 'Reveal Comment',
      arguments: [note.id],
    };
  }

  private buildDescription(): string {
    if (this.note.lines) {
      return `L${this.note.lines.start}–${this.note.lines.end}`;
    }
    return `Pos ${this.note.position.start}–${this.note.position.end}`;
  }

  private buildTooltip(): string {
    const lines = [`Comment: ${this.note.text}`, '', `Selected: "${this.note.quote.exact}"`];

    if (this.note.lines) {
      lines.push(`Lines: ${this.note.lines.start}–${this.note.lines.end}`);
    }

    lines.push(`Created: ${new Date(this.note.createdAt).toLocaleString()}`);

    return lines.join('\n');
  }
}

export class FileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly fileUri: string,
    public readonly noteCount: number,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(vscode.workspace.asRelativePath(fileUri), collapsibleState);

    this.tooltip = `${noteCount} comment(s)`;
    this.description = `${noteCount} comment(s)`;
    this.contextValue = 'file';
    this.iconPath = new vscode.ThemeIcon('file');
  }
}

export class CommentsViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private storage: StorageManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // Root level: show files with comments
      return this.getFileItems();
    }

    if (element instanceof FileTreeItem) {
      // Show comments for this file
      return this.getCommentItems(element.fileUri);
    }

    return [];
  }

  private async getFileItems(): Promise<FileTreeItem[]> {
    const allNotes = await this.storage.getAllNotes();
    const items: FileTreeItem[] = [];

    for (const [fileUri, notes] of allNotes.entries()) {
      if (notes.length > 0) {
        items.push(
          new FileTreeItem(fileUri, notes.length, vscode.TreeItemCollapsibleState.Expanded)
        );
      }
    }

    return items;
  }

  private async getCommentItems(fileUri: string): Promise<CommentTreeItem[]> {
    const notes = await this.storage.getNotes(fileUri);

    // Sort by position
    notes.sort((a, b) => a.position.start - b.position.start);

    return notes.map(
      (note) => new CommentTreeItem(note, vscode.TreeItemCollapsibleState.None)
    );
  }

  /**
   * Get all comments for the active editor
   */
  async getActiveFileComments(): Promise<Note[]> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
      return [];
    }

    return this.storage.getNotes(activeEditor.document.uri.toString());
  }
}
