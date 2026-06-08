/**
 * Tests for the markdown file watcher wiring.
 *
 * Regression: when a new .md file is created in the workspace, the VS Code
 * Explorer updates but the Commentary sidebar went stale because nothing
 * watched the filesystem for new/removed markdown files.
 */

import * as assert from 'assert';
import { wireMarkdownFileWatcher, FileChangeWatcher, VscodeDisposable } from './fileWatcher';

/** A fake FileSystemWatcher that lets tests fire create/delete/change events. */
function createFakeWatcher() {
  const created: Array<(uri: unknown) => void> = [];
  const deleted: Array<(uri: unknown) => void> = [];
  const changed: Array<(uri: unknown) => void> = [];
  let disposed = false;

  const watcher: FileChangeWatcher & {
    fireCreate(uri: unknown): void;
    fireDelete(uri: unknown): void;
    fireChange(uri: unknown): void;
    readonly isDisposed: boolean;
  } = {
    onDidCreate(listener): VscodeDisposable {
      created.push(listener);
      return { dispose() {} };
    },
    onDidDelete(listener): VscodeDisposable {
      deleted.push(listener);
      return { dispose() {} };
    },
    onDidChange(listener): VscodeDisposable {
      changed.push(listener);
      return { dispose() {} };
    },
    dispose() {
      disposed = true;
    },
    fireCreate(uri) {
      created.forEach((l) => l(uri));
    },
    fireDelete(uri) {
      deleted.forEach((l) => l(uri));
    },
    fireChange(uri) {
      changed.forEach((l) => l(uri));
    },
    get isDisposed() {
      return disposed;
    },
  };

  return watcher;
}

suite('wireMarkdownFileWatcher', () => {
  test('refreshes when a markdown file is created', () => {
    const watcher = createFakeWatcher();
    let refreshCount = 0;
    wireMarkdownFileWatcher(watcher, () => {
      refreshCount++;
    });

    watcher.fireCreate({ fsPath: '/ws/new-file.md' });

    assert.strictEqual(refreshCount, 1, 'creating a markdown file should refresh the sidebar');
  });

  test('refreshes when a markdown file is deleted', () => {
    const watcher = createFakeWatcher();
    let refreshCount = 0;
    wireMarkdownFileWatcher(watcher, () => {
      refreshCount++;
    });

    watcher.fireDelete({ fsPath: '/ws/gone.md' });

    assert.strictEqual(refreshCount, 1, 'deleting a markdown file should refresh the sidebar');
  });

  test('ignores files inside node_modules', () => {
    const watcher = createFakeWatcher();
    let refreshCount = 0;
    wireMarkdownFileWatcher(watcher, () => {
      refreshCount++;
    });

    watcher.fireCreate({ fsPath: '/ws/node_modules/some-pkg/README.md' });

    assert.strictEqual(refreshCount, 0, 'node_modules churn should not refresh the sidebar');
  });

  test('ignores files inside .git', () => {
    const watcher = createFakeWatcher();
    let refreshCount = 0;
    wireMarkdownFileWatcher(watcher, () => {
      refreshCount++;
    });

    watcher.fireDelete({ fsPath: '/ws/.git/COMMIT_EDITMSG.md' });

    assert.strictEqual(refreshCount, 0, '.git churn should not refresh the sidebar');
  });

  test('does not refresh on content change (the file list is unchanged)', () => {
    const watcher = createFakeWatcher();
    let refreshCount = 0;
    wireMarkdownFileWatcher(watcher, () => {
      refreshCount++;
    });

    watcher.fireChange({ fsPath: '/ws/edited.md' });

    assert.strictEqual(refreshCount, 0, 'editing a file should not rebuild the tree');
  });

  test('returns disposables that include the watcher itself', () => {
    const watcher = createFakeWatcher();
    const disposables = wireMarkdownFileWatcher(watcher, () => {});

    assert.ok(disposables.length >= 1, 'should return at least one disposable');
    disposables.forEach((d) => d.dispose());
    assert.strictEqual(watcher.isDisposed, true, 'disposing should dispose the underlying watcher');
  });
});
