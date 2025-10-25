/**
 * Storage layer tests
 * Tests for WorkspaceStorage and SidecarStorage
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { WorkspaceStorage } from '../../storage/workspaceStorage';
import { SidecarStorage } from '../../storage/sidecarStorage';
import { Note } from '../../types';

suite('Storage Tests', () => {
  let context: vscode.ExtensionContext;

  suiteSetup(() => {
    const ext = vscode.extensions.getExtension('hughesjared.commentary');
    if (!ext) {
      throw new Error('Extension not found');
    }
    context = ext.exports?.context || ext;
  });

  suite('WorkspaceStorage', () => {
    let storage: WorkspaceStorage;

    setup(() => {
      storage = new WorkspaceStorage(context);
    });

    teardown(async () => {
      // Clean up all test data
      await context.workspaceState.update('commentary.notes', undefined);
    });

    test('Should save and retrieve note', async () => {
      const note: Note = {
        id: 'test-1',
        file: 'file:///test.md',
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'Test comment',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note);
      const notes = await storage.getNotes(note.file);

      assert.strictEqual(notes.length, 1);
      assert.strictEqual(notes[0].id, 'test-1');
      assert.strictEqual(notes[0].text, 'Test comment');
    });

    test('Should update existing note', async () => {
      const note: Note = {
        id: 'test-1',
        file: 'file:///test.md',
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'Original',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note);

      // Update
      note.text = 'Updated';
      await storage.saveNote(note);

      const notes = await storage.getNotes(note.file);
      assert.strictEqual(notes.length, 1);
      assert.strictEqual(notes[0].text, 'Updated');
    });

    test('Should save multiple notes for same file', async () => {
      const note1: Note = {
        id: 'test-1',
        file: 'file:///test.md',
        quote: { exact: 'test1', prefix: '', suffix: '' },
        position: { start: 0, end: 5 },
        text: 'Comment 1',
        createdAt: new Date().toISOString(),
      };

      const note2: Note = {
        id: 'test-2',
        file: 'file:///test.md',
        quote: { exact: 'test2', prefix: '', suffix: '' },
        position: { start: 10, end: 15 },
        text: 'Comment 2',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note1);
      await storage.saveNote(note2);

      const notes = await storage.getNotes(note1.file);
      assert.strictEqual(notes.length, 2);
    });

    test('Should delete note', async () => {
      const note: Note = {
        id: 'test-1',
        file: 'file:///test.md',
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'To delete',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note);
      await storage.deleteNote(note.id, note.file);

      const notes = await storage.getNotes(note.file);
      assert.strictEqual(notes.length, 0);
    });

    test('Should delete all notes for file', async () => {
      const note1: Note = {
        id: 'test-1',
        file: 'file:///test.md',
        quote: { exact: 'test1', prefix: '', suffix: '' },
        position: { start: 0, end: 5 },
        text: 'Comment 1',
        createdAt: new Date().toISOString(),
      };

      const note2: Note = {
        id: 'test-2',
        file: 'file:///test.md',
        quote: { exact: 'test2', prefix: '', suffix: '' },
        position: { start: 10, end: 15 },
        text: 'Comment 2',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note1);
      await storage.saveNote(note2);
      await storage.deleteAllNotes(note1.file);

      const notes = await storage.getNotes(note1.file);
      assert.strictEqual(notes.length, 0);
    });

    test('Should handle multiple files', async () => {
      const note1: Note = {
        id: 'test-1',
        file: 'file:///file1.md',
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'File 1 comment',
        createdAt: new Date().toISOString(),
      };

      const note2: Note = {
        id: 'test-2',
        file: 'file:///file2.md',
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'File 2 comment',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note1);
      await storage.saveNote(note2);

      const allNotes = await storage.getAllNotes();
      assert.strictEqual(allNotes.size, 2);
      assert.strictEqual(allNotes.get('file:///file1.md')?.length, 1);
      assert.strictEqual(allNotes.get('file:///file2.md')?.length, 1);
    });

    test('Should export notes as JSON', async () => {
      const note: Note = {
        id: 'test-1',
        file: 'file:///test.md',
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'Test comment',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      await storage.saveNote(note);
      const exported = await storage.exportNotes();

      const parsed = JSON.parse(exported);
      assert.ok(parsed['file:///test.md']);
      assert.strictEqual(parsed['file:///test.md'].length, 1);
      assert.strictEqual(parsed['file:///test.md'][0].id, 'test-1');
    });

    test('Should import notes from JSON', async () => {
      const data = JSON.stringify({
        'file:///imported.md': [
          {
            id: 'import-1',
            file: 'file:///imported.md',
            quote: { exact: 'test', prefix: '', suffix: '' },
            position: { start: 0, end: 4 },
            text: 'Imported comment',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      await storage.importNotes(data);
      const notes = await storage.getNotes('file:///imported.md');

      assert.strictEqual(notes.length, 1);
      assert.strictEqual(notes[0].id, 'import-1');
      assert.strictEqual(notes[0].text, 'Imported comment');
    });

    test('Should handle invalid import data', async () => {
      await assert.rejects(
        async () => await storage.importNotes('invalid json'),
        /Failed to import notes/
      );
    });

    test('Should return empty array for non-existent file', async () => {
      const notes = await storage.getNotes('file:///nonexistent.md');
      assert.strictEqual(notes.length, 0);
    });

    test('Should handle document-level comments', async () => {
      const docNote: Note = {
        id: 'doc-1',
        file: 'file:///test.md',
        quote: { exact: '[Entire Document]', prefix: '', suffix: '' },
        position: { start: 0, end: 0 },
        text: 'Document comment',
        createdAt: new Date().toISOString(),
        isDocumentLevel: true,
      };

      await storage.saveNote(docNote);
      const notes = await storage.getNotes(docNote.file);

      assert.strictEqual(notes.length, 1);
      assert.strictEqual(notes[0].isDocumentLevel, true);
    });
  });

  suite('SidecarStorage', () => {
    let storage: SidecarStorage;
    let workspaceUri: vscode.Uri;

    suiteSetup(() => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        // Create a temporary workspace URI for testing
        workspaceUri = vscode.Uri.file('/tmp/commentary-test');
      } else {
        workspaceUri = folders[0].uri;
      }
    });

    setup(() => {
      storage = new SidecarStorage(workspaceUri);
    });

    teardown(async () => {
      // Clean up .comments directory
      try {
        const commentsDir = vscode.Uri.joinPath(workspaceUri, '.comments');
        await vscode.workspace.fs.delete(commentsDir, { recursive: true });
      } catch {
        // Directory might not exist
      }
    });

    test('Should save and retrieve note', async () => {
      const note: Note = {
        id: 'test-1',
        file: vscode.Uri.joinPath(workspaceUri, 'test.md').toString(),
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'Test comment',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note);
      const notes = await storage.getNotes(note.file);

      assert.strictEqual(notes.length, 1);
      assert.strictEqual(notes[0].id, 'test-1');
      assert.strictEqual(notes[0].text, 'Test comment');
    });

    test('Should create .comments directory if not exists', async () => {
      const note: Note = {
        id: 'test-1',
        file: vscode.Uri.joinPath(workspaceUri, 'test.md').toString(),
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'Test comment',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note);

      const commentsDir = vscode.Uri.joinPath(workspaceUri, '.comments');
      const stat = await vscode.workspace.fs.stat(commentsDir);
      assert.strictEqual(stat.type, vscode.FileType.Directory);
    });

    test('Should update existing note', async () => {
      const note: Note = {
        id: 'test-1',
        file: vscode.Uri.joinPath(workspaceUri, 'test.md').toString(),
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'Original',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note);

      note.text = 'Updated';
      await storage.saveNote(note);

      const notes = await storage.getNotes(note.file);
      assert.strictEqual(notes.length, 1);
      assert.strictEqual(notes[0].text, 'Updated');
    });

    test('Should delete note', async () => {
      const note: Note = {
        id: 'test-1',
        file: vscode.Uri.joinPath(workspaceUri, 'test.md').toString(),
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'To delete',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note);
      await storage.deleteNote(note.id, note.file);

      const notes = await storage.getNotes(note.file);
      assert.strictEqual(notes.length, 0);
    });

    test('Should delete comment file when last note is deleted', async () => {
      const note: Note = {
        id: 'test-1',
        file: vscode.Uri.joinPath(workspaceUri, 'test.md').toString(),
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'Only note',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note);
      await storage.deleteNote(note.id, note.file);

      // Verify file was deleted
      const allNotes = await storage.getAllNotes();
      assert.strictEqual(allNotes.size, 0);
    });

    test('Should export notes as JSON', async () => {
      const note: Note = {
        id: 'test-1',
        file: vscode.Uri.joinPath(workspaceUri, 'test.md').toString(),
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'Test comment',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      await storage.saveNote(note);
      const exported = await storage.exportNotes();

      const parsed = JSON.parse(exported);
      assert.ok(Object.keys(parsed).length > 0);
    });

    test('Should import notes from JSON', async () => {
      const fileUri = vscode.Uri.joinPath(workspaceUri, 'imported.md').toString();
      const data = JSON.stringify({
        [fileUri]: [
          {
            id: 'import-1',
            file: fileUri,
            quote: { exact: 'test', prefix: '', suffix: '' },
            position: { start: 0, end: 4 },
            text: 'Imported comment',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      await storage.importNotes(data);
      const notes = await storage.getNotes(fileUri);

      assert.strictEqual(notes.length, 1);
      assert.strictEqual(notes[0].id, 'import-1');
    });

    test('Should return empty array for non-existent file', async () => {
      const notes = await storage.getNotes('file:///nonexistent.md');
      assert.strictEqual(notes.length, 0);
    });
  });
});
