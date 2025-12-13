/**
 * Sidebar tree view for displaying comments with hierarchical folder structure
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { StorageManager } from '../storage';
import { MarkdownWebviewProvider } from '../preview/markdownWebview';
import { FolderTreeItem, FileTreeItem, CommentTreeItem } from './treeItems';
import { buildFolderTree, getWorkspaceRelativePath, getDisplayPath, FileNode, FolderNode, isFileInWorkspace } from '../utils/fileTree';
import { NotesChangedEvent } from '../types';
import { GitStatusProvider, GitStatus } from './gitStatusProvider';
import { ExpansionStateManager } from './expansionStateManager';

export { CommentTreeItem, FileTreeItem, FolderTreeItem };

export class CommentsViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private static readonly INITIAL_REVEAL_DELAY_MS = 50;
  private static readonly REVEAL_RETRY_DELAY_MS = 100;
  private static readonly MAX_REVEAL_ATTEMPTS = 6;

  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private treeView: vscode.TreeView<vscode.TreeItem> | undefined;
  private folderTree: FolderNode | null = null; // Cache the folder tree
  private fileItemsByUri = new Map<string, FileTreeItem>();
  private folderItemsByPath = new Map<string, FolderTreeItem>(); // Cache folder items for object identity
  private commentItemsById = new Map<string, CommentTreeItem>();
  private commentIdsByFileUri = new Map<string, Set<string>>();
  private pendingReveal: { fileUri: string; noteId?: string } | null = null;
  private pendingRevealAttempts = 0;
  private activeFileUri: string | undefined;
  private gitStatusProvider: GitStatusProvider;
  private expansionStateManager: ExpansionStateManager;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private storage: StorageManager,
    private webviewProvider: MarkdownWebviewProvider,
    private context: vscode.ExtensionContext
  ) {
    // Initialize providers
    this.gitStatusProvider = new GitStatusProvider();
    this.expansionStateManager = new ExpansionStateManager(context);

    // Watch for Git status changes
    this.disposables.push(
      this.gitStatusProvider.onDidChangeStatus(() => {
        // Refresh to update Git status indicators
        this.folderTree = null; // Clear cache to rebuild with new Git status
        this._onDidChangeTreeData.fire();
      })
    );

    // Track active editor for file highlighting
    this.updateActiveFile();
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.updateActiveFile();
        this._onDidChangeTreeData.fire(); // Refresh to update active file highlighting
      })
    );
  }

  private updateActiveFile(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'markdown') {
      this.activeFileUri = editor.document.uri.toString();
      console.log('[CommentsView] Active file updated to:', this.activeFileUri);
      // Only expand if sidebar is visible - don't steal focus from Explorer
      if (this.treeView?.visible) {
        console.log('[CommentsView] Sidebar is visible, expanding parent folders');
        // Expand parent folders to make active file visible
        // Use setTimeout to ensure tree is built before expanding
        setTimeout(() => {
          void this.expandParentsOfActiveFile();
        }, 100);
      }
    } else {
      this.activeFileUri = undefined;
    }
  }

  setTreeView(treeView: vscode.TreeView<vscode.TreeItem>): void {
    this.treeView = treeView;
    this.updateEmptyMessage(); // Set initial message

    // Track folder expansion/collapse for state persistence
    this.disposables.push(
      treeView.onDidExpandElement((e) => {
        if (e.element instanceof FolderTreeItem) {
          this.expansionStateManager.setExpanded(e.element.folderPath, true);
        }
      })
    );

    this.disposables.push(
      treeView.onDidCollapseElement((e) => {
        if (e.element instanceof FolderTreeItem) {
          this.expansionStateManager.setExpanded(e.element.folderPath, false);
        }
      })
    );

    // Auto-expand parent folders and open preview when sidebar becomes visible
    this.disposables.push(
      treeView.onDidChangeVisibility(async (e) => {
        if (e.visible) {
          await this.expandParentsOfActiveFile();
          await this.openActiveFileInPreview();
        }
      })
    );

    // Expand on initial load if active file exists
    if (this.activeFileUri) {
      setTimeout(() => {
        void this.expandParentsOfActiveFile();
      }, 100);
    }
  }

  private async expandParentsOfActiveFile(): Promise<void> {
    if (!this.activeFileUri || !this.treeView) {
      return;
    }

    // Build folder tree if not already built
    if (!this.folderTree) {
      this.folderTree = await this.buildFolderTree();
    }

    const relativePath = getWorkspaceRelativePath(this.activeFileUri);
    if (!relativePath) {
      return;
    }

    // Expand all parent folders
    // Note: vscode.workspace.asRelativePath() returns forward slashes on all platforms
    const parts = relativePath.split('/');
    let currentPath = '';

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? path.join(currentPath, parts[i]) : parts[i];
      const folderItem = this.findFolderItemByPath(currentPath);

      if (folderItem) {
        try {
          await this.treeView.reveal(folderItem, { expand: true, select: false, focus: false });
          this.expansionStateManager.setExpanded(currentPath, true);
        } catch (error) {
          // Ignore reveal errors (folder might not exist in tree yet)
          console.log('[CommentsView] Could not reveal folder:', currentPath, error);
        }
      }
    }

    // Reveal the active file
    const fileItem = this.fileItemsByUri.get(this.activeFileUri);
    console.log('[CommentsView] Looking for fileItem for:', this.activeFileUri, 'Found:', !!fileItem);
    console.log('[CommentsView] Available file URIs in map:', Array.from(this.fileItemsByUri.keys()));
    if (fileItem) {
      try {
        await this.treeView.reveal(fileItem, { expand: false, select: true, focus: false });
        console.log('[CommentsView] Successfully revealed and selected active file');
      } catch (error) {
        console.log('[CommentsView] Could not reveal active file:', error);
      }
    } else {
      console.log('[CommentsView] Active file not found in fileItemsByUri map');
    }
  }

  private async openActiveFileInPreview(): Promise<void> {
    if (!this.activeFileUri) {
      return;
    }

    try {
      const uri = vscode.Uri.parse(this.activeFileUri);
      const document = await vscode.workspace.openTextDocument(uri);

      // Only open preview for markdown files
      if (document.languageId === 'markdown') {
        await this.webviewProvider.openMarkdown(document);
        console.log('[CommentsView] Opened active file in preview:', this.activeFileUri);
      }
    } catch (error) {
      console.log('[CommentsView] Could not open active file in preview:', error);
    }
  }

  private findFolderItemByPath(folderPath: string): FolderTreeItem | undefined {
    // Check cache first - essential for VS Code TreeView.reveal() object identity
    if (this.folderItemsByPath.has(folderPath)) {
      return this.folderItemsByPath.get(folderPath)!;
    }

    if (!this.folderTree) {
      return undefined;
    }

    const folderNode = this.findFolderNode(this.folderTree, folderPath);
    if (!folderNode) {
      return undefined;
    }

    // Create and cache the item
    const folderItem = new FolderTreeItem(
      folderNode.path,
      folderNode.label,
      folderNode.files.length + this.countSubfolderFiles(folderNode),
      folderNode.commentCount
    );

    this.folderItemsByPath.set(folderPath, folderItem);
    return folderItem;
  }

  refresh(event?: NotesChangedEvent): void {
    console.log('[CommentsView] refresh() called with event:', event);

    if (event) {
      // Selective cache invalidation: only clear cache for the affected file
      this.clearCommentCacheForFile(event.type === 'deleted' ? event.documentUri! : event.note.file);
      this.folderTree = null; // Still invalidate folder tree since it includes comment counts
      this.folderItemsByPath.clear(); // Clear folder cache since tree structure may have changed
    } else {
      // Full refresh: clear all caches
      this.folderTree = null;
      this.fileItemsByUri.clear();
      this.folderItemsByPath.clear();
      this.commentItemsById.clear();
      this.commentIdsByFileUri.clear();
    }

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
      console.log('[CommentsView] Scheduling reveal in', CommentsViewProvider.INITIAL_REVEAL_DELAY_MS, 'ms');
      setTimeout(() => {
        void this.revealPending();
      }, CommentsViewProvider.INITIAL_REVEAL_DELAY_MS);
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

  getParent(element: vscode.TreeItem): vscode.TreeItem | undefined {
    if (element instanceof CommentTreeItem) {
      // Return parent FileTreeItem
      return this.fileItemsByUri.get(element.note.file);
    }

    if (element instanceof FileTreeItem) {
      // Return parent FolderTreeItem if file is nested
      if (!this.folderTree) {
        return undefined;
      }
      return this.findParentFolderForFile(this.folderTree, element.fileUri);
    }

    if (element instanceof FolderTreeItem) {
      // Return parent folder or undefined if at root
      if (!this.folderTree) {
        return undefined;
      }
      return this.findParentFolderForFolder(this.folderTree, element.folderPath);
    }

    return undefined;
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
      // Use saved expansion state
      const wasExpanded = this.expansionStateManager.isExpanded(folder.path);
      const collapsibleState = wasExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed;

      // Get or create folder item (ensuring object identity for reveal())
      let folderItem = this.folderItemsByPath.get(folder.path);
      if (!folderItem) {
        folderItem = new FolderTreeItem(
          folder.path,
          folderName,
          folder.files.length + this.countSubfolderFiles(folder),
          folder.commentCount,
          collapsibleState
        );
        this.folderItemsByPath.set(folder.path, folderItem);
      } else {
        // Update collapsibleState in case it changed
        folderItem.collapsibleState = collapsibleState;
      }

      items.push(folderItem);
    }

    // Add root-level files
    for (const file of this.folderTree.files) {
      // Files with comments are always expanded, files without comments are not collapsible
      const collapsibleState = file.commentCount > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None;

      // Get Git status for this file
      const gitStatus = file.gitStatus || GitStatus.Unmodified;

      // Check if this is the active file
      const isActive = this.activeFileUri === file.uri;

      const fileItem = new FileTreeItem(
        file.uri,
        file.fileName,
        file.commentCount,
        collapsibleState,
        isActive,
        gitStatus
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
      // Use saved expansion state
      const wasExpanded = this.expansionStateManager.isExpanded(folder.path);
      const collapsibleState = wasExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed;

      // Get or create folder item (ensuring object identity for reveal())
      let folderItem = this.folderItemsByPath.get(folder.path);
      if (!folderItem) {
        folderItem = new FolderTreeItem(
          folder.path,
          folderName,
          folder.files.length + this.countSubfolderFiles(folder),
          folder.commentCount,
          collapsibleState
        );
        this.folderItemsByPath.set(folder.path, folderItem);
      } else {
        // Update collapsibleState in case it changed
        folderItem.collapsibleState = collapsibleState;
      }

      items.push(folderItem);
    }

    // Add files
    for (const file of folderNode.files) {
      // Files with comments are always expanded, files without comments are not collapsible
      const collapsibleState = file.commentCount > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None;

      // Get Git status for this file
      const gitStatus = file.gitStatus || GitStatus.Unmodified;

      // Check if this is the active file
      const isActive = this.activeFileUri === file.uri;

      const fileItem = new FileTreeItem(
        file.uri,
        file.fileName,
        file.commentCount,
        collapsibleState,
        isActive,
        gitStatus
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

    // Only populate cache if not already populated (avoid race with reveal)
    const noteIds = new Set<string>();

    const items = notes.map((note) => {
      const item = new CommentTreeItem(note, vscode.TreeItemCollapsibleState.None);
      this.commentItemsById.set(note.id, item);
      noteIds.add(note.id);
      return item;
    });

    this.commentIdsByFileUri.set(fileUri, noteIds);

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

      // Get Git status for this file
      const gitStatus = await this.gitStatusProvider.getStatus(fileUri);

      const fileNode: FileNode = {
        uri: uriString,
        relativePath: relativePath || getDisplayPath(uriString),
        fileName: fileUri.fsPath.split('/').pop() || '',
        commentCount: notes.length,
        gitStatus
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

  private findParentFolderForFile(root: FolderNode, fileUri: string): FolderTreeItem | undefined {
    // Check if file is at this level
    for (const file of root.files) {
      if (file.uri === fileUri) {
        // File found at this level - return this folder if not root
        if (root.path) {
          // Use findFolderItemByPath to ensure object identity
          return this.findFolderItemByPath(root.path);
        }
        return undefined; // File is at root level
      }
    }

    // Recursively search subfolders
    for (const folder of root.subfolders.values()) {
      const found = this.findParentFolderForFile(folder, fileUri);
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  private findParentFolderForFolder(root: FolderNode, folderPath: string): FolderTreeItem | undefined {
    // Check if this folder is a direct child
    for (const [, folder] of root.subfolders) {
      if (folder.path === folderPath) {
        // Found folder at this level - return parent
        if (root.path) {
          // Use findFolderItemByPath to ensure object identity
          return this.findFolderItemByPath(root.path);
        }
        return undefined; // Folder is at root level
      }
    }

    // Recursively search subfolders
    for (const folder of root.subfolders.values()) {
      const found = this.findParentFolderForFolder(folder, folderPath);
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  private clearCommentCacheForFile(fileUri: string): void {
    const ids = this.commentIdsByFileUri.get(fileUri);
    if (ids) {
      for (const id of ids) {
        this.commentItemsById.delete(id);
      }
      this.commentIdsByFileUri.delete(fileUri);
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
    if (this.pendingRevealAttempts > CommentsViewProvider.MAX_REVEAL_ATTEMPTS) {
      console.warn('[CommentsView] Unable to reveal pending comment after', CommentsViewProvider.MAX_REVEAL_ATTEMPTS, 'attempts');
      this.pendingReveal = null;
      return;
    }

    setTimeout(() => {
      void this.revealPending();
    }, CommentsViewProvider.REVEAL_RETRY_DELAY_MS);
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.gitStatusProvider.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
