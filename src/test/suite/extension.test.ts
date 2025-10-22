import * as assert from 'assert';
import * as vscode from 'vscode';
import { WorkspaceStorage } from '../../storage/workspaceStorage';
import { Note } from '../../types';

suite('Commentary Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('your-publisher-name.commentary'));
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('your-publisher-name.commentary');
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
    assert.ok(commentaryCommands.includes('commentary.refreshComments'));
    assert.ok(commentaryCommands.includes('commentary.revealComment'));
  });
});

suite('Storage Tests', () => {
  let storage: WorkspaceStorage;

  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('your-publisher-name.commentary');
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
});
