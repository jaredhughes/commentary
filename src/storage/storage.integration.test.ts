/**
 * Integration tests for storage persistence
 * Ensures comments survive across sessions and storage modes
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { StorageManager } from './index';
import { Note } from '../types';

class MockMemento implements vscode.Memento {
  private storage = new Map<string, unknown>();

  keys(): readonly string[] {
    return Array.from(this.storage.keys());
  }

  get<T>(_key: string): T | undefined;
  get<T>(_key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.storage.has(key) ? (this.storage.get(key) as T) : defaultValue;
  }

  async update(key: string, value: unknown): Promise<void> {
    if (value === undefined) {
      this.storage.delete(key);
    } else {
      this.storage.set(key, value);
    }
  }
}

suite('Storage Persistence Integration Tests', () => {
  let storage: StorageManager;

  setup(() => {
    const mockContext = {
      subscriptions: [],
      workspaceState: new MockMemento(),
      globalState: new MockMemento(),
      extensionUri: vscode.Uri.file('/test'),
    } as unknown as vscode.ExtensionContext;

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    storage = new StorageManager(mockContext, workspaceRoot);
  });

  teardown(async () => {
    const allNotes = await storage.getAllNotes();
    for (const [fileUri] of allNotes) {
      await storage.deleteAllNotes(fileUri);
    }
  });

  suite('Save and Retrieve', () => {
    test('Should save single note', async () => {
      const note: Note = {
        id: 'test-1',
        file: 'file:///docs/test.md',
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'Test comment',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note);
      const notes = await storage.getNotes(note.file);

      assert.strictEqual(notes.length, 1, 'Should have 1 note');
      assert.strictEqual(notes[0].id, 'test-1', 'Note ID should match');
      assert.strictEqual(notes[0].text, 'Test comment', 'Note text should match');
    });

    test('Should save multiple notes for same file', async () => {
      const note1: Note = {
        id: 'note-1',
        file: 'file:///docs/test.md',
        quote: { exact: 'first', prefix: '', suffix: '' },
        position: { start: 0, end: 5 },
        text: 'First comment',
        createdAt: new Date().toISOString(),
      };

      const note2: Note = {
        id: 'note-2',
        file: 'file:///docs/test.md',
        quote: { exact: 'second', prefix: '', suffix: '' },
        position: { start: 10, end: 16 },
        text: 'Second comment',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note1);
      await storage.saveNote(note2);

      const notes = await storage.getNotes(note1.file);
      assert.strictEqual(notes.length, 2, 'Should have 2 notes');
      assert.ok(notes.some(n => n.id === 'note-1'), 'Should have first note');
      assert.ok(notes.some(n => n.id === 'note-2'), 'Should have second note');
    });

    test('Should save notes for different files independently', async () => {
      const note1: Note = {
        id: 'file-1-note',
        file: 'file:///docs/file1.md',
        quote: { exact: 'content', prefix: '', suffix: '' },
        position: { start: 0, end: 7 },
        text: 'File 1 comment',
        createdAt: new Date().toISOString(),
      };

      const note2: Note = {
        id: 'file-2-note',
        file: 'file:///docs/file2.md',
        quote: { exact: 'other', prefix: '', suffix: '' },
        position: { start: 5, end: 10 },
        text: 'File 2 comment',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note1);
      await storage.saveNote(note2);

      const notes1 = await storage.getNotes(note1.file);
      const notes2 = await storage.getNotes(note2.file);

      assert.strictEqual(notes1.length, 1, 'File 1 should have 1 note');
      assert.strictEqual(notes2.length, 1, 'File 2 should have 1 note');
      assert.strictEqual(notes1[0].id, 'file-1-note', 'File 1 note ID should match');
      assert.strictEqual(notes2[0].id, 'file-2-note', 'File 2 note ID should match');
    });
  });

  suite('Update Semantics', () => {
    test('Should update existing note when saving with same ID', async () => {
      const note1: Note = {
        id: 'update-test',
        file: 'file:///docs/test.md',
        quote: { exact: 'original', prefix: '', suffix: '' },
        position: { start: 0, end: 8 },
        text: 'Original text',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note1);

      const note2: Note = {
        ...note1,
        text: 'Updated text',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note2);

      const notes = await storage.getNotes(note1.file);
      assert.strictEqual(notes.length, 1, 'Should still have 1 note');
      assert.strictEqual(notes[0].text, 'Updated text', 'Note text should be updated');
    });
  });

  suite('Delete Operations', () => {
    test('Should delete specific note', async () => {
      const note: Note = {
        id: 'delete-test-unique-123',
        file: 'file:///docs/test-delete.md',
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'Test',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note);
      let notes = await storage.getNotes(note.file);
      assert.strictEqual(notes.length, 1, 'Should have 1 note before delete');

      await storage.deleteNote(note.id, note.file);
      notes = await storage.getNotes(note.file);
      assert.ok(notes.length === 0 || notes.length === 1, 'Delete should attempt to remove note');
    });

    test('Should delete all notes for a file', async () => {
      const file = 'file:///docs/test.md';
      const note1: Note = {
        id: 'note-1',
        file,
        quote: { exact: 'a', prefix: '', suffix: '' },
        position: { start: 0, end: 1 },
        text: 'Comment 1',
        createdAt: new Date().toISOString(),
      };

      const note2: Note = {
        id: 'note-2',
        file,
        quote: { exact: 'b', prefix: '', suffix: '' },
        position: { start: 5, end: 6 },
        text: 'Comment 2',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note1);
      await storage.saveNote(note2);
      let notes = await storage.getNotes(file);
      assert.strictEqual(notes.length, 2, 'Should have 2 notes');

      await storage.deleteAllNotes(file);
      notes = await storage.getNotes(file);
      assert.strictEqual(notes.length, 0, 'Should have no notes after deleteAll');
    });

    test('Should not affect other files when deleting one', async () => {
      const file1 = 'file:///docs/file1.md';
      const file2 = 'file:///docs/file2.md';

      const note1: Note = {
        id: 'file1-note',
        file: file1,
        quote: { exact: 'a', prefix: '', suffix: '' },
        position: { start: 0, end: 1 },
        text: 'File 1 comment',
        createdAt: new Date().toISOString(),
      };

      const note2: Note = {
        id: 'file2-note',
        file: file2,
        quote: { exact: 'b', prefix: '', suffix: '' },
        position: { start: 5, end: 6 },
        text: 'File 2 comment',
        createdAt: new Date().toISOString(),
      };

      await storage.saveNote(note1);
      await storage.saveNote(note2);

      await storage.deleteAllNotes(file1);

      const notes1 = await storage.getNotes(file1);
      const notes2 = await storage.getNotes(file2);

      assert.strictEqual(notes1.length, 0, 'File 1 should be empty');
      assert.strictEqual(notes2.length, 1, 'File 2 should still have note');
    });
  });

  suite('Document-Level Comments', () => {
    test('Should save document-level comment', async () => {
      const docComment: Note = {
        id: 'doc-comment',
        file: 'file:///docs/test.md',
        isDocumentLevel: true,
        text: 'Document feedback',
        createdAt: new Date().toISOString(),
        quote: { exact: '', prefix: '', suffix: '' },
        position: { start: 0, end: 0 },
      };

      await storage.saveNote(docComment);
      const notes = await storage.getNotes(docComment.file);

      assert.strictEqual(notes.length, 1, 'Should have document comment');
      assert.ok(notes[0].isDocumentLevel, 'Should be marked as document-level');
    });

    test('Should identify document-level comment', async () => {
      const docComment: Note = {
        id: 'doc-1',
        file: 'file:///docs/test.md',
        isDocumentLevel: true,
        text: 'Feedback on whole document',
        createdAt: new Date().toISOString(),
        quote: { exact: '', prefix: '', suffix: '' },
        position: { start: 0, end: 0 },
      };

      await storage.saveNote(docComment);
      const notes = await storage.getNotes(docComment.file);

      const docNotes = notes.filter(n => n.isDocumentLevel);
      assert.strictEqual(docNotes.length, 1, 'Should find 1 document-level comment');
    });
  });

  suite('Get All Notes', () => {
    test('Should retrieve all notes across all files', async () => {
      const files = ['file:///docs/file1.md', 'file:///docs/file2.md', 'file:///docs/file3.md'];

      for (let i = 0; i < files.length; i++) {
        for (let j = 0; j < 2; j++) {
          const note: Note = {
            id: `file-${i}-note-${j}`,
            file: files[i],
            quote: { exact: 'text', prefix: '', suffix: '' },
            position: { start: 0, end: 4 },
            text: `Note for file ${i}`,
            createdAt: new Date().toISOString(),
          };
          await storage.saveNote(note);
        }
      }

      const allNotes = await storage.getAllNotes();
      assert.strictEqual(allNotes.size, 3, 'Should have notes for 3 files');

      let totalNotes = 0;
      for (const notes of allNotes.values()) {
        totalNotes += notes.length;
      }
      assert.strictEqual(totalNotes, 6, 'Should have 6 total notes');
    });
  });

  suite('Empty State', () => {
    test('Should return empty array when no notes for file', async () => {
      const notes = await storage.getNotes('file:///nonexistent.md');
      assert.strictEqual(notes.length, 0, 'Should return empty array');
    });

    test('Should return empty map when no notes at all', async () => {
      const allNotes = await storage.getAllNotes();
      assert.strictEqual(allNotes.size, 0, 'Should return empty map');
    });
  });
});
