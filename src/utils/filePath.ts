/**
 * Pure functions for file path manipulation
 * Extracted from sidecarStorage.ts and commentsView.ts for better testability
 */

import * as path from 'path';

/**
 * Sanitize a file URI to create a valid comment filename
 * Replaces path separators and Windows-illegal characters
 * @param fileUri The file URI (e.g., "file:///C:/Users/name/file.md")
 * @returns Safe filename (e.g., "file____C__Users_name_file.md.json")
 */
export function sanitizeFileUriForFilename(fileUri: string): string {
  // Remove the file:// protocol if present
  let cleaned = fileUri.replace(/^file:\/\/\/?/, '');

  // Replace all path separators and Windows-illegal filename characters
  // Windows illegal: < > : " | ? * and path separators / \
  cleaned = cleaned
    .replace(/[/\\:]/g, '_')
    .replace(/[<>"|?*]/g, '_');

  return `${cleaned}.json`;
}

/**
 * Format a file path for display in UI
 * - Workspace-relative if in workspace
 * - Home-relative (~/) if outside workspace
 * - Just filename as last resort
 * @param fullPath Absolute file path
 * @param workspacePaths Array of workspace folder paths
 * @param homeDir User's home directory path
 * @returns Formatted path for display
 */
export function formatPathForDisplay(
  fullPath: string,
  workspacePaths: string[],
  homeDir: string
): string {
  // First try to make it workspace-relative
  for (const workspacePath of workspacePaths) {
    if (fullPath.startsWith(workspacePath)) {
      const relativePath = path.relative(workspacePath, fullPath);
      // Make sure it's actually inside (doesn't start with ..)
      if (!relativePath.startsWith('..')) {
        return relativePath;
      }
    }
  }

  // Try home-relative
  if (fullPath.startsWith(homeDir)) {
    return '~' + fullPath.substring(homeDir.length);
  }

  // Last resort: just the filename
  return path.basename(fullPath);
}

/**
 * Check if a path is inside any of the given workspace paths
 * @param fullPath Absolute file path to check
 * @param workspacePaths Array of workspace folder paths
 * @returns true if path is inside a workspace
 */
export function isPathInWorkspace(fullPath: string, workspacePaths: string[]): boolean {
  return workspacePaths.some(workspacePath => {
    if (!fullPath.startsWith(workspacePath)) {
      return false;
    }
    const relativePath = path.relative(workspacePath, fullPath);
    return !relativePath.startsWith('..');
  });
}

/**
 * Get the relative path from a workspace folder
 * @param fullPath Absolute file path
 * @param workspacePaths Array of workspace folder paths
 * @returns Relative path, or null if not in any workspace
 */
export function getWorkspaceRelativePath(
  fullPath: string,
  workspacePaths: string[]
): string | null {
  for (const workspacePath of workspacePaths) {
    if (fullPath.startsWith(workspacePath)) {
      const relativePath = path.relative(workspacePath, fullPath);
      if (!relativePath.startsWith('..')) {
        return relativePath;
      }
    }
  }
  return null;
}
