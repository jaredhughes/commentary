/**
 * Sidebar tree view for displaying comments with hierarchical folder structure
 */

import * as vscode from 'vscode';
import { StorageManager } from '../storage';
import { MarkdownWebviewProvider } from '../preview/markdownWebview';
import { FolderTreeItem, FileTreeItem, CommentTreeItem } from './treeItems';
import { buildFolderTree, getWorkspaceRelativePath, getDisplayPath, FileNode, FolderNode, isFileInWorkspace } from '../utils/fileTree';
import { NotesChangedEvent } from '../types';

export { CommentTreeItem, FileTreeItem, FolderTreeItem };

export class CommentsViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private treeView: vscode.TreeView<vscode.TreeItem> | undefined;
  private folderTree: FolderNode | null = null; // Cache the folder tree
  private fileItemsByUri = new Map<string, FileTreeItem>();
  private commentItemsById = new Map<string, CommentTreeItem>();
  private pendingReveal: { fileUri: string; noteId?: string } | null = null;
  private pendingRevealAttempts = 0;

  constructor(
    private storage: StorageManager,
    private webviewProvider: MarkdownWebviewProvider
  ) {}

  setTreeView(treeView: vscode.TreeView<vscode.TreeItem>): void {
    this.treeView = treeView;
    this.updateEmptyMessage(); // Set initial message
  }

  refresh(event?: NotesChangedEvent): void {
    console.log('[CommentsView] refresh() called with event:', event);
    this.folderTree = null; // Invalidate cache
    this.fileItemsByUri.clear();
    this.commentItemsById.clear();

    if (event) {
      this.pendingRevealAttempts = 0;
      if (event.type === 'added' || event.type === 'updated') {
        this.pendingReveal = { fileUri: event.note.file, noteId: event.note.id };
        console.log('[CommentsView] Set pending reveal for:', event.note.id, 'in file:', event.note.file);
      } else if (event.type === 'deleted') {
        this.pendingReveal = { fileUri: event.documentUri };
        console.log('[CommentsView] Set pending reveal for deleted note in file:', event.documentUri);
      }
    } else {
      this.pendingReveal = null;
      console.log('[CommentsView] No event, clearing pending reveal');
    }

    this._onDidChangeTreeData.fire();
    console.log('[CommentsView] _onDidChangeTreeData fired');

    // Update context for button visibility (fire and forget)
    this.updateContext();

    // Update empty state message
    this.updateEmptyMessage();

    if (this.pendingReveal) {
      console.log('[CommentsView] Scheduling reveal in 50ms');
      setTimeout(() => {
        void this.revealPending();
      }, 50);
    }
  }

  private async updateContext(): Promise<void> {
    const allNotes = await this.storage.getAllNotes();
    const hasComments = Array.from(allNotes.values()).some(notes => notes.length > 0);
    await vscode.commands.executeCommand('setContext', 'commentary.hasComments', hasComments);
  }

  private async updateEmptyMessage(): Promise<void> {
    if (!this.treeView) {
      return;
    }

    const allNotes = await this.storage.getAllNotes();
    const hasComments = Array.from(allNotes.values()).some(notes => notes.length > 0);

    if (hasComments) {
      this.treeView.message = undefined;
    } else {
      this.treeView.message = 'No comments yet.\n\nOpen a Markdown file and select text in the preview to add a comment.';
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    console.log('[CommentsView] getTreeItem called');
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    console.log('[CommentsView] getChildren called, element:', element);

    if (!element) {
      // Root level: build and show folder hierarchy
      return this.getRootItems();
    }

    if (element instanceof FolderTreeItem) {
      // Show subfolders and files in this folder
      return this.getFolderChildren(element);
    }

    if (element instanceof FileTreeItem) {
      // Show comments for this file
      return this.getCommentItems(element.fileUri);
    }

    return [];
  }

  private async getRootItems(): Promise<vscode.TreeItem[]> {
    console.log('[CommentsView] getRootItems called');

    // Build the folder tree if not cached
    if (!this.folderTree) {
      this.folderTree = await this.buildFolderTree();
    }

    const items: vscode.TreeItem[] = [];

    // Add subfolders
    for (const [folderName, folder] of this.folderTree.subfolders) {
      items.push(new FolderTreeItem(
        folder.path,
        folderName,
        folder.files.length + this.countSubfolderFiles(folder),
        folder.commentCount
      ));
    }

    // Add root-level files
    for (const file of this.folderTree.files) {
      // Files with comments are always expanded, files without comments are not collapsible
      const collapsibleState = file.commentCount > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None;

      const fileItem = new FileTreeItem(
        file.uri,
        file.fileName,
        file.commentCount,
        collapsibleState
      );
      this.fileItemsByUri.set(file.uri, fileItem);
      items.push(fileItem);
    }

    // Sort: folders first, then files
    items.sort((a, b) => {
      if (a instanceof FolderTreeItem && b instanceof FileTreeItem) {
        return -1;
      }
      if (a instanceof FileTreeItem && b instanceof FolderTreeItem) {
        return 1;
      }
      return (a.label || '').toString().localeCompare((b.label || '').toString());
    });

    console.log('[CommentsView] Returning root items:', items.length);
    return items;
  }

  private async getFolderChildren(folderItem: FolderTreeItem): Promise<vscode.TreeItem[]> {
    console.log('[CommentsView] getFolderChildren called for:', folderItem.folderPath);

    if (!this.folderTree) {
      this.folderTree = await this.buildFolderTree();
    }

    // Find the folder node
    const folderNode = this.findFolderNode(this.folderTree, folderItem.folderPath);
    if (!folderNode) {
      return [];
    }

    const items: vscode.TreeItem[] = [];

    // Add subfolders
    for (const [folderName, folder] of folderNode.subfolders) {
      items.push(new FolderTreeItem(
        folder.path,
        folderName,
        folder.files.length + this.countSubfolderFiles(folder),
        folder.commentCount
      ));
    }

    // Add files
    for (const file of folderNode.files) {
      // Files with comments are always expanded, files without comments are not collapsible
      const collapsibleState = file.commentCount > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None;

      const fileItem = new FileTreeItem(
        file.uri,
        file.fileName,
        file.commentCount,
        collapsibleState
      );
      this.fileItemsByUri.set(file.uri, fileItem);
      items.push(fileItem);
    }

    // Sort: folders first, then files
    items.sort((a, b) => {
      if (a instanceof FolderTreeItem && b instanceof FileTreeItem) {
        return -1;
      }
      if (a instanceof FileTreeItem && b instanceof FolderTreeItem) {
        return 1;
      }
      return (a.label || '').toString().localeCompare((b.label || '').toString());
    });

    console.log('[CommentsView] Returning folder children:', items.length);
    return items;
  }

  private async getCommentItems(fileUri: string): Promise<CommentTreeItem[]> {
    console.log('[CommentsView] getCommentItems called for:', fileUri);
    const notes = await this.storage.getNotes(fileUri);
    console.log('[CommentsView] Got', notes.length, 'notes');

    this.clearCommentCacheForFile(fileUri);

    const items = notes.map((note) => {
      const item = new CommentTreeItem(note, vscode.TreeItemCollapsibleState.None);
      this.commentItemsById.set(note.id, item);
      return item;
    });

    console.log('[CommentsView] Returning comment items for file:', items.length);
    return items;
  }

  private async buildFolderTree(): Promise<FolderNode> {
    console.log('[CommentsView] buildFolderTree called');

    // Find all markdown files in workspace
    const workspaceFiles = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
    console.log('[CommentsView] Found', workspaceFiles.length, 'markdown files in workspace');

    const uniqueWorkspaceFiles = new Map<string, vscode.Uri>();
    for (const fileUri of workspaceFiles) {
      uniqueWorkspaceFiles.set(fileUri.toString(), fileUri);
    }
    if (uniqueWorkspaceFiles.size !== workspaceFiles.length) {
      console.log('[CommentsView] Deduplicated markdown files from', workspaceFiles.length, 'to', uniqueWorkspaceFiles.size);
    }

    // Get all notes to check which files have comments
    const allNotes = await this.storage.getAllNotes();
    console.log('[CommentsView] getAllNotes returned:', allNotes.size, 'files with notes');

    // Build file nodes with workspace-relative paths
    const fileNodes: FileNode[] = [];
    const filesOutsideWorkspace: FileNode[] = [];

    for (const fileUri of uniqueWorkspaceFiles.values()) {
      const uriString = fileUri.toString();
      const notes = allNotes.get(uriString) || [];
      const relativePath = getWorkspaceRelativePath(uriString);

      const fileNode: FileNode = {
        uri: uriString,
        relativePath: relativePath || getDisplayPath(uriString),
        fileName: fileUri.fsPath.split('/').pop() || '',
        commentCount: notes.length
      };

      if (relativePath && isFileInWorkspace(uriString)) {
        fileNodes.push(fileNode);
      } else {
        // Files outside workspace go to a special section
        filesOutsideWorkspace.push(fileNode);
      }
    }

    // Build the folder tree
    const tree = buildFolderTree(fileNodes);

    // Add files outside workspace as a special folder if any exist
    if (filesOutsideWorkspace.length > 0) {
      const externalFolder: FolderNode = {
        path: '__external__',
        label: 'External Files',
        files: filesOutsideWorkspace,
        subfolders: new Map(),
        commentCount: filesOutsideWorkspace.reduce((sum, f) => sum + f.commentCount, 0)
      };
      tree.subfolders.set('__external__', externalFolder);
    }

    console.log('[CommentsView] Built folder tree with', tree.subfolders.size, 'root folders');
    return tree;
  }

  private findFolderNode(root: FolderNode, targetPath: string): FolderNode | null {
    if (root.path === targetPath) {
      return root;
    }

    for (const subfolder of root.subfolders.values()) {
      const found = this.findFolderNode(subfolder, targetPath);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private countSubfolderFiles(folder: FolderNode): number {
    let count = 0;
    for (const subfolder of folder.subfolders.values()) {
      count += subfolder.files.length + this.countSubfolderFiles(subfolder);
    }
    return count;
  }

  private clearCommentCacheForFile(fileUri: string): void {
    for (const [id, item] of this.commentItemsById.entries()) {
      if (item.note.file === fileUri) {
        this.commentItemsById.delete(id);
      }
    }
  }

  private async revealPending(): Promise<void> {
    if (!this.pendingReveal || !this.treeView) {
      return;
    }

    const { fileUri, noteId } = this.pendingReveal;
    const fileItem = this.fileItemsByUri.get(fileUri);

    if (!fileItem) {
      this.scheduleRevealRetry();
      return;
    }

    try {
      await this.treeView.reveal(fileItem, { expand: true, focus: false, select: !noteId });
    } catch (error) {
      console.error('[CommentsView] Failed to reveal file item', error);
    }

    if (!noteId) {
      this.pendingReveal = null;
      this.pendingRevealAttempts = 0;
      return;
    }

    const commentItem = this.commentItemsById.get(noteId);
    if (!commentItem) {
      this.scheduleRevealRetry();
      return;
    }

    try {
      await this.treeView.reveal(commentItem, { select: true, focus: true, expand: true });
    } catch (error) {
      console.error('[CommentsView] Failed to reveal comment item', error);
    }

    this.pendingReveal = null;
    this.pendingRevealAttempts = 0;
  }

  private scheduleRevealRetry(): void {
    if (!this.pendingReveal) {
      return;
    }

    this.pendingRevealAttempts += 1;
    if (this.pendingRevealAttempts > 6) {
      console.warn('[CommentsView] Unable to reveal pending comment after multiple attempts');
      this.pendingReveal = null;
      return;
    }

    setTimeout(() => {
      void this.revealPending();
    }, 100);
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
