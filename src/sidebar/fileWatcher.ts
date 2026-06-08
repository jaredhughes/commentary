/**
 * Pure wiring for keeping the Commentary sidebar in sync with the filesystem.
 * No direct vscode import so it can be unit-tested with a fake watcher; the
 * real vscode.FileSystemWatcher satisfies FileChangeWatcher structurally.
 */

export interface VscodeDisposable {
  dispose(): void;
}

/**
 * The subset of vscode.FileSystemWatcher we rely on. vscode's Event<Uri> is
 * callable as (listener) => Disposable, matching these method signatures.
 */
export interface FileChangeWatcher extends VscodeDisposable {
  onDidCreate(listener: (uri: unknown) => void): VscodeDisposable;
  onDidDelete(listener: (uri: unknown) => void): VscodeDisposable;
  onDidChange(listener: (uri: unknown) => void): VscodeDisposable;
}

/** Minimal shape of a vscode.Uri for path inspection. */
interface UriLike {
  fsPath?: string;
  path?: string;
}

/**
 * Paths that should never trigger a sidebar refresh — dependency and VCS
 * directories that the tree already excludes (commentsView filters
 * node_modules via findFiles), so reacting to their churn is wasted work.
 */
function isIgnoredPath(uri: unknown): boolean {
  const u = uri as UriLike | null;
  const p = u?.fsPath || u?.path || '';
  return p.includes('/node_modules/') || p.includes('/.git/');
}

/**
 * Refresh the sidebar when markdown files are created or deleted in the
 * workspace. Content changes (onDidChange) are intentionally ignored — they
 * don't alter which files appear in the tree — as are node_modules/.git paths.
 *
 * @returns disposables (the event subscriptions plus the watcher) to register
 *          with the extension context.
 */
export function wireMarkdownFileWatcher(
  watcher: FileChangeWatcher,
  refresh: (uri?: unknown) => void
): VscodeDisposable[] {
  const handle = (uri: unknown) => {
    if (isIgnoredPath(uri)) {
      return;
    }
    refresh(uri);
  };
  return [
    watcher.onDidCreate(handle),
    watcher.onDidDelete(handle),
    // onDidChange is intentionally NOT wired — editing a file's contents does
    // not change which files appear in the tree.
    watcher,
  ];
}
