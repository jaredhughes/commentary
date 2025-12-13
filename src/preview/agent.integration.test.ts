/**
 * Integration tests for Save and Submit to Agent functionality
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { Note, NotesChangedEvent, MessageType, PreviewMessage, SerializedSelection } from '../types';
import { StorageManager } from '../storage';
import { OverlayHost } from './overlayHost';

class MockMemento implements vscode.Memento {
  private storage = new Map<string, unknown>();

  keys(): readonly string[] {
    return Array.from(this.storage.keys());
  }

  get<T>(_key: string): T | undefined;
  get<T>(_key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.storage.has(key) ? this.storage.get(key) as T : defaultValue;
  }

  async update(key: string, value: unknown): Promise<void> {
    if (value === undefined) {
      this.storage.delete(key);
    } else {
      this.storage.set(key, value);
    }
  }
}

suite('Agent Integration Tests', () => {
  let context: vscode.ExtensionContext;
  let storage: StorageManager;
  let overlayHost: OverlayHost;

  suiteSetup(() => {
    context = {
      subscriptions: [],
      workspaceState: new MockMemento(),
      globalState: new MockMemento(),
      extensionUri: vscode.Uri.file('/test'),
    } as unknown as vscode.ExtensionContext;
  });

  setup(async () => {
    await (context.workspaceState as MockMemento).update('commentary.notes', undefined);

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    storage = new StorageManager(context, workspaceRoot);
    overlayHost = new OverlayHost(context, storage);
  });

  teardown(async () => {
    const allNotes = await storage.getAllNotes();
    for (const [fileUri] of allNotes) {
      await storage.deleteAllNotes(fileUri);
    }

    await (context.workspaceState as MockMemento).update('commentary.notes', undefined);

    if (overlayHost) {
      overlayHost.dispose();
    }
  });

  suite('Save and Submit to Agent', () => {
    test('Should save comment and emit added event', async () => {
      let eventEmitted: NotesChangedEvent | undefined;

      overlayHost.onNotesChanged((event) => {
        eventEmitted = event;
      });

      const message: PreviewMessage & {
        documentUri?: string;
        selection?: SerializedSelection;
        commentText?: string;
      } = {
        type: MessageType.saveAndSubmitToAgent,
        selection: {
          quote: { exact: 'test', prefix: '', suffix: '' },
          position: { start: 0, end: 4 },
        },
        commentText: 'Send to agent',
        documentUri: 'file:///test.md',
      };

      const panel = {
        onDidDispose: () => ({ dispose: () => {} }),
        webview: { postMessage: async () => true },
      };

      overlayHost.registerWebview(panel as unknown as vscode.WebviewPanel, 'file:///test.md');
      await overlayHost.handlePreviewMessage(message as PreviewMessage, 'file:///test.md', panel as unknown as vscode.WebviewPanel);

      // Should have saved the note
      const notes = await storage.getNotes('file:///test.md');
      assert.strictEqual(notes.length, 1);
      assert.strictEqual(notes[0].text, 'Send to agent');

      // Should have emitted added event
      assert.ok(eventEmitted);
      assert.strictEqual(eventEmitted?.type, 'added');
      if (eventEmitted?.type === 'added') {
        assert.strictEqual(eventEmitted.note.text, 'Send to agent');
      }
    });

    test('Should update existing comment when submitting with noteId', async function() {
      // Increase timeout for flaky macOS Node 20.x environment
      this.timeout(5000);

      // Create initial comment
      const note: Note = {
        id: 'test-1',
        file: 'file:///test.md',
        quote: { exact: 'test', prefix: '', suffix: '' },
        position: { start: 0, end: 4 },
        text: 'Original',
        createdAt: new Date().toISOString(),
      };
      await storage.saveNote(note);

      let eventEmitted: NotesChangedEvent | undefined;
      overlayHost.onNotesChanged((event) => {
        eventEmitted = event;
      });

      // Submit updated version
      const message: PreviewMessage & {
        documentUri?: string;
        noteId?: string;
        selection?: SerializedSelection;
        commentText?: string;
      } = {
        type: MessageType.saveAndSubmitToAgent,
        noteId: 'test-1',
        selection: {
          quote: { exact: 'test', prefix: '', suffix: '' },
          position: { start: 0, end: 4 },
        },
        commentText: 'Updated and sent',
        documentUri: 'file:///test.md',
      };

      const panel = {
        onDidDispose: () => ({ dispose: () => {} }),
        webview: { postMessage: async () => true },
      };

      overlayHost.registerWebview(panel as unknown as vscode.WebviewPanel, 'file:///test.md');
      await overlayHost.handlePreviewMessage(message as PreviewMessage, 'file:///test.md', panel as unknown as vscode.WebviewPanel);

      // Should have updated the note
      const notes = await storage.getNotes('file:///test.md');
      assert.strictEqual(notes.length, 1);
      assert.strictEqual(notes[0].text, 'Updated and sent');

      // Should have emitted updated event
      assert.ok(eventEmitted);
      assert.strictEqual(eventEmitted?.type, 'updated');
      if (eventEmitted?.type === 'updated') {
        assert.strictEqual(eventEmitted.note.text, 'Updated and sent');
      }
    });

    test('Should handle document-level save and submit', async () => {
      let eventEmitted: NotesChangedEvent | undefined;

      overlayHost.onNotesChanged((event) => {
        eventEmitted = event;
      });

      const message: PreviewMessage & {
        documentUri?: string;
        selection?: SerializedSelection;
        commentText?: string;
        isDocumentLevel?: boolean;
      } = {
        type: MessageType.saveAndSubmitToAgent,
        selection: {
          quote: { exact: '[Entire Document]', prefix: '', suffix: '' },
          position: { start: 0, end: 0 },
        },
        commentText: 'Document feedback',
        isDocumentLevel: true,
        documentUri: 'file:///test.md',
      };

      const panel = {
        onDidDispose: () => ({ dispose: () => {} }),
        webview: { postMessage: async () => true },
      };

      overlayHost.registerWebview(panel as unknown as vscode.WebviewPanel, 'file:///test.md');
      await overlayHost.handlePreviewMessage(message as PreviewMessage, 'file:///test.md', panel as unknown as vscode.WebviewPanel);

      // Should have saved document-level comment
      const notes = await storage.getNotes('file:///test.md');
      assert.strictEqual(notes.length, 1);
      assert.ok(notes[0].isDocumentLevel);

      // Should have emitted event
      assert.ok(eventEmitted);
      assert.strictEqual(eventEmitted?.type, 'added');
    });
  });
});
