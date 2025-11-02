/**
 * Tree item classes for the sidebar view
 * Supports hierarchical folder structure
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Note } from '../types';

/**
 * Represents a folder in the tree
 */
export class FolderTreeItem extends vscode.TreeItem {
  constructor(
    public readonly folderPath: string,
    public readonly label: string,
    public readonly fileCount: number,
    public readonly commentCount: number
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    
    // Set ID for state tracking
    this.id = `folder:${folderPath}`;
    
    // Show comment count in description
    if (commentCount > 0) {
      this.description = `${commentCount} comment${commentCount === 1 ? '' : 's'}`;
      this.tooltip = `${fileCount} file${fileCount === 1 ? '' : 's'}, ${commentCount} comment${commentCount === 1 ? '' : 's'}`;
    } else {
      this.description = `${fileCount} file${fileCount === 1 ? '' : 's'}`;
      this.tooltip = `${fileCount} file${fileCount === 1 ? '' : 's'}`;
    }
    
    // Use folder icon
    this.iconPath = new vscode.ThemeIcon('folder');
    this.contextValue = 'folder';
  }
}

/**
 * Represents a file in the tree
 */
export class FileTreeItem extends vscode.TreeItem {
  public collapsibleState: vscode.TreeItemCollapsibleState;
  
  constructor(
    public readonly fileUri: string,
    public readonly fileName: string,
    public readonly noteCount: number, // Expose as public for toggle functionality
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(fileName, collapsibleState);
    this.collapsibleState = collapsibleState;
    
    // Set ID to the file URI so VS Code can track this item's state
    this.id = `file:${fileUri}`;

    // Update tooltip and description based on comment count
    if (noteCount === 0) {
      this.tooltip = 'No comments yet';
      this.description = '';
      this.iconPath = new vscode.ThemeIcon('file', new vscode.ThemeColor('disabledForeground'));
    } else {
      this.tooltip = `${noteCount} comment${noteCount === 1 ? '' : 's'}`;
      this.description = `${noteCount} comment${noteCount === 1 ? '' : 's'}`;
      this.iconPath = new vscode.ThemeIcon('markdown', new vscode.ThemeColor('charts.blue'));
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
 * Represents a comment in the tree
 */
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
      return '?? Entire document';
    }
    if (this.note.lines) {
      return `L${this.note.lines.start}?${this.note.lines.end}`;
    }
    return `Pos ${this.note.position.start}?${this.note.position.end}`;
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
      lines.push(`Lines: ${this.note.lines.start}?${this.note.lines.end}`);
    }

    lines.push(`Created: ${new Date(this.note.createdAt).toLocaleString()}`);
    lines.push('', 'Click to edit');

    return lines.join('\n');
  }
}
