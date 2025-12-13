/**
 * Pure utility functions for building file tree structure
 * Converts flat file list into hierarchical folder structure
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { GitStatus } from '../sidebar/gitStatusProvider';

export interface FileNode {
  uri: string;
  relativePath: string;
  fileName: string;
  commentCount: number;
  gitStatus?: GitStatus;
}

export interface FolderNode {
  path: string;
  label: string;
  files: FileNode[];
  subfolders: Map<string, FolderNode>;
  commentCount: number;
}

/**
 * Get workspace-relative path for a file URI
 */
export function getWorkspaceRelativePath(fileUri: string): string | null {
  try {
    const uri = vscode.Uri.parse(fileUri);
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    const includeFolder = workspaceFolders.length > 1;

    // Try VS Code's built-in method first
    const workspaceRelative = vscode.workspace.asRelativePath(uri, includeFolder);
    const fullFsPath = uri.fsPath;

    // Check if it's actually relative
    const isInWorkspace = workspaceRelative !== fullFsPath &&
                          !path.isAbsolute(workspaceRelative) &&
                          workspaceRelative.length < fullFsPath.length;

    if (isInWorkspace) {
      return workspaceRelative;
    }

    // Fallback: check each workspace folder manually
    for (const folder of workspaceFolders) {
      if (fullFsPath.startsWith(folder.uri.fsPath)) {
        const relativePath = path.relative(folder.uri.fsPath, fullFsPath);
        if (!relativePath.startsWith('..')) {
          if (includeFolder) {
            return relativePath ? path.join(folder.name, relativePath) : folder.name;
          }
          return relativePath;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get display path for a file (workspace-relative, home-relative, or basename)
 */
export function getDisplayPath(fileUri: string): string {
  try {
    const uri = vscode.Uri.parse(fileUri);
    const fullPath = uri.fsPath;

    // Try workspace-relative first
    const workspaceRel = getWorkspaceRelativePath(fileUri);
    if (workspaceRel) {
      return workspaceRel;
    }

    // Try home-relative
    const homeDir = os.homedir();
    if (fullPath.startsWith(homeDir)) {
      return '~' + fullPath.substring(homeDir.length);
    }

    // Last resort: basename
    return path.basename(fullPath);
  } catch {
    return fileUri;
  }
}

/**
 * Build a hierarchical folder tree from flat file list
 * @param files - Array of file nodes with URIs and comment counts
 * @returns Root folder node containing the tree structure
 */
export function buildFolderTree(files: FileNode[]): FolderNode {
  const root: FolderNode = {
    path: '',
    label: 'Root',
    files: [],
    subfolders: new Map(),
    commentCount: 0
  };

  for (const file of files) {
    const parts = file.relativePath.split(path.sep);
    const fileName = parts[parts.length - 1];
    const folderParts = parts.slice(0, -1);

    // Navigate/create folder structure
    let currentFolder = root;
    let currentPath = '';

    for (const folderName of folderParts) {
      currentPath = currentPath ? path.join(currentPath, folderName) : folderName;

      if (!currentFolder.subfolders.has(folderName)) {
        currentFolder.subfolders.set(folderName, {
          path: currentPath,
          label: folderName,
          files: [],
          subfolders: new Map(),
          commentCount: 0
        });
      }

      currentFolder = currentFolder.subfolders.get(folderName)!;
    }

    // Add file to its folder
    currentFolder.files.push({
      ...file,
      fileName
    });

    // Update comment counts up the tree
    let folder: FolderNode | undefined = currentFolder;
    while (folder) {
      folder.commentCount += file.commentCount;

      // Navigate up to parent (find parent by path)
      if (folder === root) {
        break;
      }

      // Find parent folder
      const parentPath = path.dirname(folder.path);
      if (parentPath === '.' || parentPath === '') {
        folder = root;
      } else {
        folder = findFolderByPath(root, parentPath);
      }
    }
  }

  return root;
}

/**
 * Find a folder node by its path
 */
function findFolderByPath(root: FolderNode, targetPath: string): FolderNode | undefined {
  if (root.path === targetPath) {
    return root;
  }

  for (const subfolder of root.subfolders.values()) {
    const found = findFolderByPath(subfolder, targetPath);
    if (found) {
      return found;
    }
  }

  return undefined;
}

/**
 * Check if a file is in the workspace
 */
export function isFileInWorkspace(fileUri: string): boolean {
  return getWorkspaceRelativePath(fileUri) !== null;
}

/**
 * Get all folders in sorted order (for flat display if needed)
 */
export function getFlatFolderList(root: FolderNode): FolderNode[] {
  const folders: FolderNode[] = [];

  function traverse(node: FolderNode) {
    if (node !== root) {
      folders.push(node);
    }
    for (const subfolder of node.subfolders.values()) {
      traverse(subfolder);
    }
  }

  traverse(root);
  return folders.sort((a, b) => a.path.localeCompare(b.path));
}
