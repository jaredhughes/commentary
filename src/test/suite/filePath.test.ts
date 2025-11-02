/**
 * Tests for file path utilities
 */

import * as assert from 'assert';
import * as path from 'path';
import {
  sanitizeFileUriForFilename,
  formatPathForDisplay,
  isPathInWorkspace,
  getWorkspaceRelativePath,
} from '../../utils/filePath';

suite('File Path Utilities Test Suite', () => {
  suite('sanitizeFileUriForFilename', () => {
    test('should sanitize Unix file URI', () => {
      const result = sanitizeFileUriForFilename('file:///home/user/project/file.md');

      assert.strictEqual(result, 'home_user_project_file.md.json');
    });

    test('should sanitize Windows file URI with colon', () => {
      const result = sanitizeFileUriForFilename('file:///C:/Users/name/file.md');

      assert.strictEqual(result, 'C__Users_name_file.md.json');
    });

    test('should handle URI without file:// protocol', () => {
      const result = sanitizeFileUriForFilename('/home/user/file.md');

      assert.strictEqual(result, '_home_user_file.md.json');
    });

    test('should sanitize all illegal Windows characters', () => {
      const result = sanitizeFileUriForFilename('file:///path/with<>:"|?*chars.md');

      assert.strictEqual(result, 'path_with_______chars.md.json');
    });

    test('should handle backslashes', () => {
      const result = sanitizeFileUriForFilename('C:\\Users\\name\\file.md');

      assert.strictEqual(result, 'C__Users_name_file.md.json');
    });
  });

  suite('formatPathForDisplay', () => {
    const homeDir = '/home/user';
    const workspacePaths = ['/home/user/projects/myproject'];

    test('should show workspace-relative path for file in workspace', () => {
      const fullPath = '/home/user/projects/myproject/src/file.ts';

      const result = formatPathForDisplay(fullPath, workspacePaths, homeDir);

      assert.strictEqual(result, path.join('src', 'file.ts'));
    });

    test('should show home-relative path for file outside workspace', () => {
      const fullPath = '/home/user/documents/notes.md';

      const result = formatPathForDisplay(fullPath, workspacePaths, homeDir);

      assert.strictEqual(result, '~/documents/notes.md');
    });

    test('should show just filename for file outside home', () => {
      const fullPath = '/var/log/system.log';

      const result = formatPathForDisplay(fullPath, workspacePaths, homeDir);

      assert.strictEqual(result, 'system.log');
    });

    test('should handle file at workspace root', () => {
      const fullPath = '/home/user/projects/myproject/README.md';

      const result = formatPathForDisplay(fullPath, workspacePaths, homeDir);

      assert.strictEqual(result, 'README.md');
    });

    test('should handle multiple workspace folders', () => {
      const workspaces = [
        '/home/user/projects/project1',
        '/home/user/projects/project2',
      ];
      const fullPath = '/home/user/projects/project2/lib/util.ts';

      const result = formatPathForDisplay(fullPath, workspaces, homeDir);

      assert.strictEqual(result, path.join('lib', 'util.ts'));
    });

    test('should not show ../ for file outside workspace', () => {
      const fullPath = '/home/user/other/file.md';

      const result = formatPathForDisplay(fullPath, workspacePaths, homeDir);

      // Should be home-relative, not workspace-relative with ../
      assert.strictEqual(result, '~/other/file.md');
    });
  });

  suite('isPathInWorkspace', () => {
    const workspacePaths = ['/home/user/projects/myproject'];

    test('should return true for file in workspace', () => {
      const fullPath = '/home/user/projects/myproject/src/file.ts';

      const result = isPathInWorkspace(fullPath, workspacePaths);

      assert.strictEqual(result, true);
    });

    test('should return false for file outside workspace', () => {
      const fullPath = '/home/user/other/file.md';

      const result = isPathInWorkspace(fullPath, workspacePaths);

      assert.strictEqual(result, false);
    });

    test('should return false for file in parent directory', () => {
      const fullPath = '/home/user/projects/file.md';

      const result = isPathInWorkspace(fullPath, workspacePaths);

      assert.strictEqual(result, false);
    });

    test('should handle multiple workspaces', () => {
      const workspaces = [
        '/home/user/projects/project1',
        '/home/user/projects/project2',
      ];
      const fullPath = '/home/user/projects/project2/file.md';

      const result = isPathInWorkspace(fullPath, workspaces);

      assert.strictEqual(result, true);
    });
  });

  suite('getWorkspaceRelativePath', () => {
    const workspacePaths = ['/home/user/projects/myproject'];

    test('should return relative path for file in workspace', () => {
      const fullPath = '/home/user/projects/myproject/src/lib/util.ts';

      const result = getWorkspaceRelativePath(fullPath, workspacePaths);

      assert.strictEqual(result, path.join('src', 'lib', 'util.ts'));
    });

    test('should return null for file outside workspace', () => {
      const fullPath = '/home/user/other/file.md';

      const result = getWorkspaceRelativePath(fullPath, workspacePaths);

      assert.strictEqual(result, null);
    });

    test('should return null for file in parent directory', () => {
      const fullPath = '/home/user/projects/file.md';

      const result = getWorkspaceRelativePath(fullPath, workspacePaths);

      assert.strictEqual(result, null);
    });

    test('should handle workspace root file', () => {
      const fullPath = '/home/user/projects/myproject/package.json';

      const result = getWorkspaceRelativePath(fullPath, workspacePaths);

      assert.strictEqual(result, 'package.json');
    });
  });
});
