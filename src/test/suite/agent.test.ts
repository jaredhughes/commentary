import * as assert from 'assert';
import * as vscode from 'vscode';
import { AgentClient } from '../../agent/client';
import { PayloadBuilder } from '../../agent/payload';
import { Note } from '../../types';

suite('Agent Client Tests', () => {
  let mockContext: vscode.ExtensionContext;
  let client: AgentClient;

  setup(() => {
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: () => undefined,
        update: async () => {},
      },
      globalState: {
        get: () => undefined,
        update: async () => {},
        setKeysForSync: () => {},
      },
      extensionUri: vscode.Uri.file('/test'),
      extensionPath: '/test',
      asAbsolutePath: (relativePath: string) => `/test/${relativePath}`,
      storageUri: vscode.Uri.file('/test/storage'),
      globalStorageUri: vscode.Uri.file('/test/globalStorage'),
      logUri: vscode.Uri.file('/test/log'),
      extensionMode: vscode.ExtensionMode.Test,
      extension: {} as vscode.Extension<unknown>,
      secrets: {} as vscode.SecretStorage,
      environmentVariableCollection: {} as vscode.GlobalEnvironmentVariableCollection,
      languageModelAccessInformation: {} as vscode.LanguageModelAccessInformation,
      storagePath: '/test/storage',
      globalStoragePath: '/test/globalStorage',
      logPath: '/test/log',
    } as unknown as vscode.ExtensionContext;

    client = new AgentClient(mockContext);
  });

  teardown(() => {
    client.dispose();
  });

  suite('Provider Configuration', () => {
    test('Should have default cursor CLI path', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const cliPath = config.get<string>('cursorCliPath', 'cursor-agent');
      assert.strictEqual(cliPath, 'cursor-agent');
    });

    test('Should have default interactive mode enabled', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const interactive = config.get<boolean>('cursorInteractive', true);
      assert.strictEqual(interactive, true);
    });
  });

  suite('Provider Display Names', () => {
    // Helper to access private method for testing
    function getProviderDisplayName(clientInstance: AgentClient, provider: string): string {
      return (clientInstance as unknown as { getProviderDisplayName: (provider: string) => string }).getProviderDisplayName(provider);
    }

    test('Should return correct display name for claude', () => {
      const displayName = getProviderDisplayName(client, 'claude');
      assert.strictEqual(displayName, 'Claude');
    });

    test('Should return correct display name for cursor', () => {
      const displayName = getProviderDisplayName(client, 'cursor');
      assert.strictEqual(displayName, 'Cursor');
    });

    test('Should return correct display name for openai', () => {
      const displayName = getProviderDisplayName(client, 'openai');
      assert.strictEqual(displayName, 'OpenAI');
    });

    test('Should return correct display name for custom', () => {
      const displayName = getProviderDisplayName(client, 'custom');
      assert.strictEqual(displayName, 'AI Agent');
    });

    test('Should return default display name for unknown provider', () => {
      const displayName = getProviderDisplayName(client, 'unknown');
      assert.strictEqual(displayName, 'AI Agent');
    });
  });

  suite('Single Comment Handling', () => {
    test('Should handle single comment', async () => {
      const note: Note = createTestNote();

      // Should complete without error (agent enabled by default)
      await client.sendSingleComment(note);
      assert.ok(true);
    });
  });

  suite('Multiple Comments Handling', () => {
    test('Should handle empty notes array', async () => {
      await client.sendMultipleComments([]);
      // Should complete without error
      assert.ok(true);
    });

    test('Should handle multiple notes', async () => {
      const notes: Note[] = [
        createTestNote('note-1', 'First comment'),
        createTestNote('note-2', 'Second comment'),
        createTestNote('note-3', 'Third comment'),
      ];

      await client.sendMultipleComments(notes);
      assert.ok(true);
    });
  });
});

suite('Payload Builder Tests', () => {
  suite('Context Building', () => {
    test('Should build context for note without line numbers', async () => {
      const note: Note = createTestNote();
      const context = await PayloadBuilder.buildContext(note);

      assert.ok(context);
      assert.strictEqual(context.note.id, note.id);
      assert.strictEqual(context.note.text, note.text);
    });

    test('Should build context for note with line numbers', async () => {
      const note: Note = {
        ...createTestNote(),
        lines: { start: 5, end: 10 },
      };

      const context = await PayloadBuilder.buildContext(note);

      assert.ok(context);
      assert.strictEqual(context.note.lines?.start, 5);
      assert.strictEqual(context.note.lines?.end, 10);
    });
  });

  suite('Request Building', () => {
    test('Should build single request', async () => {
      const note = createTestNote();
      const request = await PayloadBuilder.buildSingleRequest(note);

      assert.ok(request);
      assert.strictEqual(request.contexts.length, 1);
      assert.ok(request.instruction);
    });

    test('Should build multiple request', async () => {
      const notes: Note[] = [
        createTestNote('note-1', 'First'),
        createTestNote('note-2', 'Second'),
      ];

      const request = await PayloadBuilder.buildMultipleRequest(notes);

      assert.ok(request);
      assert.strictEqual(request.contexts.length, 2);
      assert.ok(request.instruction);
    });
  });

  suite('Prompt Formatting', () => {
    test('Should format prompt with file path', async () => {
      const note = createTestNote();
      const request = await PayloadBuilder.buildSingleRequest(note);
      const prompt = PayloadBuilder.formatAsPrompt(request);

      assert.ok(prompt.includes('**File:**'));
      assert.ok(prompt.includes('test.md'));
    });

    test('Should format prompt with comment text', async () => {
      const note = createTestNote('test-id', 'This is my comment');
      const request = await PayloadBuilder.buildSingleRequest(note);
      const prompt = PayloadBuilder.formatAsPrompt(request);

      assert.ok(prompt.includes('**Comment:**'));
      assert.ok(prompt.includes('This is my comment'));
    });

    test('Should format prompt with selected text', async () => {
      const note = createTestNote();
      const request = await PayloadBuilder.buildSingleRequest(note);
      const prompt = PayloadBuilder.formatAsPrompt(request);

      assert.ok(prompt.includes('**Selected text:**'));
      assert.ok(prompt.includes('Hello World'));
    });

    test('Should format prompt with line numbers when available', async () => {
      const note: Note = {
        ...createTestNote(),
        lines: { start: 10, end: 15 },
      };

      const request = await PayloadBuilder.buildSingleRequest(note);
      const prompt = PayloadBuilder.formatAsPrompt(request);

      assert.ok(prompt.includes('**Lines:**') || prompt.includes('**Line:**'));
    });

    test('Should format prompt with multiple comments', async () => {
      const notes: Note[] = [
        createTestNote('note-1', 'First comment'),
        createTestNote('note-2', 'Second comment'),
        createTestNote('note-3', 'Third comment'),
      ];

      const request = await PayloadBuilder.buildMultipleRequest(notes);
      const prompt = PayloadBuilder.formatAsPrompt(request);

      assert.ok(prompt.includes('First comment'));
      assert.ok(prompt.includes('Second comment'));
      assert.ok(prompt.includes('Third comment'));
    });
  });
});

suite('Integration Tests', () => {
  test('Should handle end-to-end workflow for cursor provider', async () => {
    const config = vscode.workspace.getConfiguration('commentary.agent');
    await config.update('enabled', true, vscode.ConfigurationTarget.Global);
    await config.update('provider', 'cursor', vscode.ConfigurationTarget.Global);
    await config.update('cursorInteractive', true, vscode.ConfigurationTarget.Global);

    const mockContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/test'),
    } as unknown as vscode.ExtensionContext;

    const client = new AgentClient(mockContext);
    const note = createTestNote('integration-test', 'Integration test comment');

    // Should complete without throwing
    await client.sendSingleComment(note);

    client.dispose();
    assert.ok(true);
  });

  test('Should handle end-to-end workflow for claude provider', async () => {
    const config = vscode.workspace.getConfiguration('commentary.agent');
    await config.update('enabled', true, vscode.ConfigurationTarget.Global);
    await config.update('provider', 'claude', vscode.ConfigurationTarget.Global);

    const mockContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/test'),
    } as unknown as vscode.ExtensionContext;

    const client = new AgentClient(mockContext);
    const note = createTestNote('integration-test-claude', 'Claude integration test');

    // Should complete without throwing
    await client.sendSingleComment(note);

    client.dispose();
    assert.ok(true);
  });
});

// Helper function to create test notes
function createTestNote(id: string = 'test-note-1', text: string = 'Test comment'): Note {
  return {
    id,
    file: 'file:///test.md',
    quote: {
      exact: 'Hello World',
      prefix: 'This is ',
      suffix: ' for testing',
    },
    position: { start: 0, end: 11 },
    text,
    createdAt: new Date().toISOString(),
  };
}
