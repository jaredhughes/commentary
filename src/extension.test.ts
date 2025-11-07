import * as assert from 'assert';
import * as vscode from 'vscode';
import { WorkspaceStorage } from './storage/workspaceStorage';
import { Note } from './types';

suite('Commentary Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('jaredhughes.commentary'));
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('jaredhughes.commentary');
    assert.ok(extension);
    await extension?.activate();
    assert.strictEqual(extension?.isActive, true);
  });

  test('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    const commentaryCommands = commands.filter((cmd) => cmd.startsWith('commentary.'));

    assert.ok(commentaryCommands.includes('commentary.openPreview'));
    assert.ok(commentaryCommands.includes('commentary.deleteComment'));
    assert.ok(commentaryCommands.includes('commentary.deleteAllComments'));
    assert.ok(commentaryCommands.includes('commentary.sendToAgent'));
    assert.ok(commentaryCommands.includes('commentary.sendAllToAgent'));
  });

  test('All required commands should be present', async () => {
    const commands = await vscode.commands.getCommands(true);
    const requiredCommands = [
      'commentary.openPreview',
      // 'commentary.saveComment', // Handled internally by webview, not a registered command
      'commentary.deleteComment',
      'commentary.deleteAllComments',
      'commentary.sendToAgent',
      'commentary.sendAllToAgent',
      'commentary.showCommentsSidebar',
    ];

    for (const cmd of requiredCommands) {
      assert.ok(
        commands.includes(cmd),
        `Command ${cmd} should be registered`
      );
    }
  });

  test('Extension should have proper package.json metadata', () => {
    const extension = vscode.extensions.getExtension('jaredhughes.commentary');
    assert.ok(extension);

    const packageJSON = extension.packageJSON;
    assert.strictEqual(packageJSON.name, 'commentary');
    assert.strictEqual(packageJSON.displayName, 'Commentary');
    assert.ok(packageJSON.description);
    assert.ok(packageJSON.version);
  });

  test('Extension should have Cursor provider in configuration', () => {
    const extension = vscode.extensions.getExtension('jaredhughes.commentary');
    assert.ok(extension);

    const packageJSON = extension.packageJSON;
    const providerConfig = packageJSON.contributes.configuration.properties['commentary.agent.provider'];

    assert.ok(providerConfig);
    assert.ok(providerConfig.enum.includes('cursor'));
    assert.ok(providerConfig.enum.includes('claude'));
    assert.ok(providerConfig.enum.includes('vscode'));
    assert.ok(providerConfig.enum.includes('custom'));
  });

  test('Extension should have Cursor-specific configuration properties', () => {
    const extension = vscode.extensions.getExtension('jaredhughes.commentary');
    assert.ok(extension);

    const packageJSON = extension.packageJSON;
    const props = packageJSON.contributes.configuration.properties;

    assert.ok(props['commentary.agent.cursorCliPath']);
    assert.ok(props['commentary.agent.cursorInteractive']);
  });
});

suite('Storage Tests', () => {
  let storage: WorkspaceStorage;

  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('jaredhughes.commentary');
    assert.ok(extension);
  });

  setup(() => {
    const storedData: Record<string, Record<string, Note[]>> = {};

    const mockContext = {
      workspaceState: {
        get: (key: string, defaultValue?: Record<string, Note[]>): Record<string, Note[]> => storedData[key] ?? defaultValue ?? {},
        update: async (key: string, value: Record<string, Note[]>): Promise<void> => {
          storedData[key] = value;
        },
      },
    } as unknown as vscode.ExtensionContext;

    storage = new WorkspaceStorage(mockContext);
  });

  test('Should save and retrieve notes', async () => {
    const note: Note = {
      id: 'test-note-1',
      file: 'file:///test.md',
      quote: {
        exact: 'Hello World',
        prefix: 'This is ',
        suffix: ' test',
      },
      position: { start: 0, end: 11 },
      text: 'This is a test comment',
      createdAt: new Date().toISOString(),
    };

    await storage.saveNote(note);
    const notes = await storage.getNotes('file:///test.md');

    assert.strictEqual(notes.length, 1);
    assert.strictEqual(notes[0].id, 'test-note-1');
    assert.strictEqual(notes[0].text, 'This is a test comment');
  });

  test('Should delete notes', async () => {
    const note: Note = {
      id: 'test-note-2',
      file: 'file:///test.md',
      quote: {
        exact: 'Delete me',
        prefix: '',
        suffix: '',
      },
      position: { start: 0, end: 9 },
      text: 'To be deleted',
      createdAt: new Date().toISOString(),
    };

    await storage.saveNote(note);
    await storage.deleteNote('test-note-2', 'file:///test.md');
    const notes = await storage.getNotes('file:///test.md');

    assert.strictEqual(notes.length, 0);
  });

  test('Should export and import notes', async () => {
    const note: Note = {
      id: 'test-note-3',
      file: 'file:///test.md',
      quote: {
        exact: 'Export test',
        prefix: '',
        suffix: '',
      },
      position: { start: 0, end: 11 },
      text: 'Export comment',
      createdAt: new Date().toISOString(),
    };

    await storage.saveNote(note);
    const exported = await storage.exportNotes();
    assert.ok(exported.length > 0);

    const parsed = JSON.parse(exported);
    assert.ok(parsed['file:///test.md']);
    assert.strictEqual(parsed['file:///test.md'].length, 1);
  });

  test('Should handle concurrent saves without data loss', async () => {
    // Stress test: 100 concurrent saves to same file
    const fileUri = 'file:///concurrent-test.md';
    const promises = Array.from({ length: 100 }, (_, i) =>
      storage.saveNote({
        id: `note-${i}`,
        file: fileUri,
        quote: { exact: `Text ${i}`, prefix: '', suffix: '' },
        position: { start: i * 10, end: i * 10 + 5 },
        text: `Comment ${i}`,
        createdAt: new Date().toISOString(),
      })
    );

    await Promise.all(promises);
    const notes = await storage.getNotes(fileUri);

    // All 100 notes should be saved (no lost updates from race conditions)
    assert.strictEqual(notes.length, 100);

    // Verify all IDs are present
    const ids = notes.map((n) => n.id).sort();
    const expectedIds = Array.from({ length: 100 }, (_, i) => `note-${i}`).sort();
    assert.deepStrictEqual(ids, expectedIds);
  });

  test('Should handle concurrent updates to same note', async () => {
    // Stress test: 50 concurrent updates to same note ID
    const fileUri = 'file:///update-test.md';
    const noteId = 'contested-note';

    const promises = Array.from({ length: 50 }, (_, i) =>
      storage.saveNote({
        id: noteId,
        file: fileUri,
        quote: { exact: `Version ${i}`, prefix: '', suffix: '' },
        position: { start: 0, end: 10 },
        text: `Update ${i}`,
        createdAt: new Date().toISOString(),
      })
    );

    await Promise.all(promises);
    const notes = await storage.getNotes(fileUri);

    // Should have exactly 1 note (all updates merged correctly)
    assert.strictEqual(notes.length, 1);
    assert.strictEqual(notes[0].id, noteId);

    // Text should match one of the updates (last write wins)
    assert.ok(notes[0].text.startsWith('Update '));
  });

  test('Should handle concurrent saves across multiple files', async () => {
    // Stress test: 20 files × 10 notes each = 200 concurrent operations
    const promises = [];

    for (let fileIdx = 0; fileIdx < 20; fileIdx++) {
      const fileUri = `file:///file-${fileIdx}.md`;
      for (let noteIdx = 0; noteIdx < 10; noteIdx++) {
        promises.push(
          storage.saveNote({
            id: `file${fileIdx}-note${noteIdx}`,
            file: fileUri,
            quote: { exact: `Text ${noteIdx}`, prefix: '', suffix: '' },
            position: { start: noteIdx * 10, end: noteIdx * 10 + 5 },
            text: `Comment ${noteIdx}`,
            createdAt: new Date().toISOString(),
          })
        );
      }
    }

    await Promise.all(promises);

    // Verify each file has exactly 10 notes
    for (let fileIdx = 0; fileIdx < 20; fileIdx++) {
      const fileUri = `file:///file-${fileIdx}.md`;
      const notes = await storage.getNotes(fileUri);
      assert.strictEqual(
        notes.length,
        10,
        `File ${fileIdx} should have 10 notes, got ${notes.length}`
      );
    }
  });

  test('Should handle concurrent saves and deletes', async () => {
    // Stress test: Mix of saves and deletes
    const fileUri = 'file:///mixed-ops.md';

    // First, create some notes
    for (let i = 0; i < 20; i++) {
      await storage.saveNote({
        id: `note-${i}`,
        file: fileUri,
        quote: { exact: `Text ${i}`, prefix: '', suffix: '' },
        position: { start: i * 10, end: i * 10 + 5 },
        text: `Comment ${i}`,
        createdAt: new Date().toISOString(),
      });
    }

    // Now run concurrent saves and deletes
    const promises = [];

    // Add 30 new notes
    for (let i = 20; i < 50; i++) {
      promises.push(
        storage.saveNote({
          id: `note-${i}`,
          file: fileUri,
          quote: { exact: `Text ${i}`, prefix: '', suffix: '' },
          position: { start: i * 10, end: i * 10 + 5 },
          text: `Comment ${i}`,
          createdAt: new Date().toISOString(),
        })
      );
    }

    // Delete first 10 notes
    for (let i = 0; i < 10; i++) {
      promises.push(storage.deleteNote(`note-${i}`, fileUri));
    }

    await Promise.all(promises);
    const notes = await storage.getNotes(fileUri);

    // Should have: (20 initial - 10 deleted + 30 new) = 40 notes
    assert.strictEqual(notes.length, 40);

    // Verify deleted notes are gone
    const ids = notes.map((n) => n.id);
    for (let i = 0; i < 10; i++) {
      assert.ok(!ids.includes(`note-${i}`), `note-${i} should be deleted`);
    }

    // Verify new notes are present
    for (let i = 20; i < 50; i++) {
      assert.ok(ids.includes(`note-${i}`), `note-${i} should exist`);
    }
  });
});
