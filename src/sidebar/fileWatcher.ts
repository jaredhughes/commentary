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

/**
 * Refresh the sidebar when markdown files are created or deleted in the
 * workspace. Content changes (onDidChange) are intentionally ignored — they
 * don't alter which files appear in the tree.
 *
 * @returns disposables (the event subscriptions plus the watcher) to register
 *          with the extension context.
 */
export function wireMarkdownFileWatcher(
  watcher: FileChangeWatcher,
  refresh: () => void
): VscodeDisposable[] {
  return [
    watcher.onDidCreate(() => refresh()),
    watcher.onDidDelete(() => refresh()),
    // onDidChange is intentionally NOT wired — editing a file's contents does
    // not change which files appear in the tree.
    watcher,
  ];
}
