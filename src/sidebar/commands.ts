/**
 * Command handlers for Commentary extension
 */

import * as vscode from 'vscode';
import { StorageManager } from '../storage';
import { OverlayHost } from '../preview/overlayHost';
import { AgentClient } from '../agent/client';
import { CommentsViewProvider, CommentTreeItem } from './commentsView';
import { MarkdownWebviewProvider } from '../preview/markdownWebview';
import { Note } from '../types';

export class CommandManager {
  constructor(
    private context: vscode.ExtensionContext,
    private storage: StorageManager,
    private overlayHost: OverlayHost,
    private commentsView: CommentsViewProvider,
    private agentClient: AgentClient,
    private webviewProvider: MarkdownWebviewProvider
  ) {}

  registerCommands(): void {
    // Edit comment from sidebar (click behavior)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.editCommentFromSidebar', async (note: CommentTreeItem) => {
        if (!note || !note.note) {
          return;
        }
        const documentUri = note.note.file;

        // Check if the document is already open in a webview panel
        const existingPanel = (this.overlayHost as unknown as { webviewPanels: Map<string, vscode.WebviewPanel> }).webviewPanels?.get(documentUri);

        if (!existingPanel) {
          // Document not open - open it first
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(documentUri));
          await this.webviewProvider.openMarkdown(doc);

          // Wait a moment for the webview to initialize
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          // Document already open - just reveal the panel without re-opening
          existingPanel.reveal(vscode.ViewColumn.One, true); // preserveFocus = true to avoid scrolling
        }

        // Get the webview panel and show the edit bubble
        const panel = (this.overlayHost as unknown as { webviewPanels: Map<string, vscode.WebviewPanel> }).webviewPanels?.get(documentUri);
        if (panel) {
          // Use different message type for document-level comments
          const messageType = note.note.isDocumentLevel ? 'showEditBubbleForDocument' : 'showEditBubble';
          await panel.webview.postMessage({
            type: messageType,
            note: note.note,
          });
        }
      })
    );

    // Open/focus document from sidebar (click on file item)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.openDocument', async (fileUri: string) => {
        // Open the document in Commentary webview (rendered mode)
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(fileUri));
        await this.webviewProvider.openMarkdown(doc);
      })
    );


    // Delete specific comment
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.deleteComment', async (item: CommentTreeItem) => {
        if (!item || !item.note) {
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Delete comment "${item.note.text}"?`,
          { modal: true },
          'Delete'
        );

        if (confirm === 'Delete') {
          await this.storage.deleteNote(item.note.id, item.note.file);
          await this.overlayHost.refreshPreview();
          this.commentsView.refresh();
        }
      })
    );

    // Delete all comments across all documents
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.deleteAllComments', async () => {
        // Get all notes across all documents
        const allNotes = await this.storage.getAllNotes();
        const totalComments = Array.from(allNotes.values()).reduce((sum, notes) => sum + notes.length, 0);

        if (totalComments === 0) {
          vscode.window.showInformationMessage('No comments to delete');
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Delete all ${totalComments} comment${totalComments === 1 ? '' : 's'} across all documents?`,
          { modal: true },
          'Delete All'
        );

        if (confirm === 'Delete All') {
          // Delete notes for each file
          for (const fileUri of allNotes.keys()) {
            await this.storage.deleteAllNotes(fileUri);
          }

          await this.overlayHost.clearAllHighlights();
          this.commentsView.refresh();
          vscode.window.showInformationMessage(`Deleted ${totalComments} comment${totalComments === 1 ? '' : 's'}`);
        }
      })
    );

    // Send comment to agent
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendToAgent', async (item: CommentTreeItem) => {
        if (!item || !item.note) {
          return;
        }

        await this.agentClient.sendSingleComment(item.note);
      })
    );

    // Send all comments to agent (across all documents)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendAllToAgent', async () => {
        // Get all comments across all documents
        const allNotes = await this.storage.getAllNotes();
        const notes: Note[] = [];

        for (const [fileUri, fileNotes] of allNotes.entries()) {
          notes.push(...fileNotes);
        }

        if (notes.length === 0) {
          vscode.window.showInformationMessage('No comments to send');
          return;
        }

        await this.agentClient.sendMultipleComments(notes);
      })
    );

    // Export comments
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.exportComments', async () => {
        try {
          const json = await this.storage.exportNotes();
          const uri = await vscode.window.showSaveDialog({
            filters: { JSON: ['json'] },
            defaultUri: vscode.Uri.file('commentary-export.json'),
          });

          if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf8'));
            vscode.window.showInformationMessage('Comments exported successfully');
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Export failed: ${error}`);
        }
      })
    );

    // Import comments
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.importComments', async () => {
        try {
          const uris = await vscode.window.showOpenDialog({
            filters: { JSON: ['json'] },
            canSelectMany: false,
          });

          if (uris && uris.length > 0) {
            const content = await vscode.workspace.fs.readFile(uris[0]);
            const json = Buffer.from(content).toString('utf8');
            await this.storage.importNotes(json);
            await this.overlayHost.refreshPreview();
            this.commentsView.refresh();
            vscode.window.showInformationMessage('Comments imported successfully');
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Import failed: ${error}`);
        }
      })
    );

    // Refresh comments view
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.refreshComments', () => {
        this.commentsView.refresh();
      })
    );

    // Configure AI agent (new unified command)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.configureAgent', async () => {
        const config = vscode.workspace.getConfiguration('commentary.agent');
        const currentProvider = config.get<string>('provider', 'cursor');

        // Step 1: Choose provider
        interface ProviderOption {
          label: string;
          value: string;
          description: string;
        }

        const providers: ProviderOption[] = [
          {
            label: '$(sparkle) Claude API',
            value: 'claude',
            description: 'Automatic document editing via Anthropic API',
          },
          {
            label: '$(comment-discussion) Cursor',
            value: 'cursor',
            description: 'Manual chat workflow (no additional config needed)',
          },
          {
            label: '$(globe) OpenAI',
            value: 'openai',
            description: 'OpenAI API integration',
          },
          {
            label: '$(tools) Custom',
            value: 'custom',
            description: 'Custom API endpoint',
          },
        ];

        const items = providers.map((p) => ({
          ...p,
          label: p.value === currentProvider ? `${p.label} $(check)` : p.label,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: `Current: ${currentProvider} - Select AI agent provider`,
          title: 'Commentary: Configure AI Agent',
        });

        if (!selected) {
          return;
        }

        const newProvider = selected.value;

        // Step 2: Provider-specific configuration
        if (newProvider === 'claude') {
          // Check if API key already exists
          const existingKey = config.get<string>('apiKey') || process.env.ANTHROPIC_API_KEY;

          if (existingKey) {
            const action = await vscode.window.showInformationMessage(
              `Claude API key is already configured. Update it?`,
              'Keep Current',
              'Update Key',
              'Remove Key'
            );

            if (action === 'Remove Key') {
              await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);
              vscode.window.showInformationMessage('Claude API key removed');
              return;
            } else if (action !== 'Update Key') {
              return;
            }
          }

          // Prompt for API key
          const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your Anthropic API key (starts with sk-ant-)',
            placeHolder: 'sk-ant-api03-...',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
              if (!value || value.trim().length === 0) {
                return 'API key cannot be empty';
              }
              if (!value.startsWith('sk-ant-')) {
                return 'Anthropic API keys start with sk-ant-';
              }
              return null;
            }
          });

          if (!apiKey) {
            return;
          }

          // Save API key (global so it works across workspaces)
          await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
          await config.update('provider', 'claude', vscode.ConfigurationTarget.Workspace);

          vscode.window.showInformationMessage(
            '✅ Claude API configured! Comments will now be sent directly to Claude for automatic document editing.'
          );

        } else if (newProvider === 'cursor') {
          // Cursor requires no additional config
          await config.update('provider', 'cursor', vscode.ConfigurationTarget.Workspace);

          vscode.window.showInformationMessage(
            '✅ Cursor configured! Comments will open in Cursor chat (requires manual paste).'
          );

        } else if (newProvider === 'openai') {
          // Prompt for OpenAI API key
          const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your OpenAI API key',
            placeHolder: 'sk-...',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
              if (!value || value.trim().length === 0) {
                return 'API key cannot be empty';
              }
              return null;
            }
          });

          if (!apiKey) {
            return;
          }

          await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
          await config.update('provider', 'openai', vscode.ConfigurationTarget.Workspace);

          vscode.window.showInformationMessage(
            '✅ OpenAI configured! (Note: Full OpenAI integration coming soon)'
          );

        } else if (newProvider === 'custom') {
          // Prompt for custom endpoint
          const endpoint = await vscode.window.showInputBox({
            prompt: 'Enter custom API endpoint URL',
            placeHolder: 'https://api.example.com/v1/chat',
            ignoreFocusOut: true,
            validateInput: (value) => {
              if (!value || value.trim().length === 0) {
                return 'Endpoint cannot be empty';
              }
              try {
                new URL(value);
                return null;
              } catch {
                return 'Invalid URL';
              }
            }
          });

          if (!endpoint) {
            return;
          }

          await config.update('endpoint', endpoint, vscode.ConfigurationTarget.Global);
          await config.update('provider', 'custom', vscode.ConfigurationTarget.Workspace);

          vscode.window.showInformationMessage(
            '✅ Custom endpoint configured!'
          );
        }
      })
    );

    // Toggle AI agent provider (legacy - kept for backwards compatibility)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.toggleAgentProvider', async () => {
        // Redirect to new configure command
        await vscode.commands.executeCommand('commentary.configureAgent');
      })
    );

    // Edit comment
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.editComment', async (item: CommentTreeItem) => {
        if (!item || !item.note) {
          return;
        }

        const newText = await vscode.window.showInputBox({
          prompt: 'Edit comment',
          value: item.note.text,
          placeHolder: 'Enter comment text...',
          ignoreFocusOut: true,
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return 'Comment cannot be empty';
            }
            return null;
          }
        });

        if (newText !== undefined && newText.trim() !== item.note.text) {
          // Update the note
          const updatedNote = {
            ...item.note,
            text: newText.trim()
          };

          await this.storage.saveNote(updatedNote);
          this.commentsView.refresh();
          vscode.window.showInformationMessage('Comment updated');
        }
      })
    );

    // Add document-level comment
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.addDocumentComment', async (documentUri?: string) => {
        // Try to get document URI from parameter, fall back to active editor
        let targetUri: string | undefined = documentUri;
        let documentText: string;
        let lineCount: number;

        if (targetUri) {
          // URI provided (from preview button) - load document directly
          try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(targetUri));
            documentText = doc.getText();
            lineCount = doc.lineCount;
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to open document: ${error}`);
            return;
          }
        } else {
          // No URI provided (from command palette) - use active editor
          const activeEditor = vscode.window.activeTextEditor;
          if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
            vscode.window.showWarningMessage('Please open a Markdown file to add a document comment');
            return;
          }
          targetUri = activeEditor.document.uri.toString();
          documentText = activeEditor.document.getText();
          lineCount = activeEditor.document.lineCount;
        }

        const commentText = await vscode.window.showInputBox({
          prompt: 'Add comment for entire document',
          placeHolder: 'Enter comment text...',
          ignoreFocusOut: true,
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return 'Comment cannot be empty';
            }
            return null;
          }
        });

        if (!commentText) {
          return;
        }

        // Create a document-level note
        const note = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          file: targetUri,
          quote: {
            exact: '[Entire Document]',
            prefix: '',
            suffix: ''
          },
          position: {
            start: 0,
            end: documentText.length
          },
          lines: {
            start: 1,
            end: lineCount
          },
          text: commentText.trim(),
          createdAt: new Date().toISOString(),
          isDocumentLevel: true
        };

        await this.storage.saveNote(note);
        this.commentsView.refresh();
        vscode.window.showInformationMessage('Document comment added');
      })
    );

    // Debug: List available commands (helps find Cursor chat command)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.listAvailableCommands', async () => {
        const allCommands = await vscode.commands.getCommands(true);

        // Filter for potentially relevant commands
        const relevantCommands = allCommands.filter(cmd =>
          cmd.includes('chat') ||
          cmd.includes('cursor') ||
          cmd.includes('ai') ||
          cmd.includes('composer') ||
          cmd.includes('copilot')
        );

        const outputChannel = vscode.window.createOutputChannel('Commentary Debug');
        outputChannel.clear();
        outputChannel.appendLine('=== Available Chat/AI Commands ===');
        outputChannel.appendLine('');

        if (relevantCommands.length > 0) {
          relevantCommands.forEach(cmd => {
            outputChannel.appendLine(`• ${cmd}`);
          });
        } else {
          outputChannel.appendLine('No chat/AI commands found');
          outputChannel.appendLine('');
          outputChannel.appendLine('All available commands:');
          allCommands.slice(0, 50).forEach(cmd => {
            outputChannel.appendLine(`• ${cmd}`);
          });
          outputChannel.appendLine(`... and ${allCommands.length - 50} more`);
        }

        outputChannel.show();
        vscode.window.showInformationMessage(
          `Found ${relevantCommands.length} chat/AI commands - check Output panel`,
          'OK'
        );
      })
    );

    // Select theme
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.selectTheme', async () => {
        const config = vscode.workspace.getConfiguration('commentary.theme');
        const currentTheme = config.get<string>('name', 'github-light');

        // Define theme options organized by package
        interface ThemeOption {
          label: string;
          value: string;
          description: string;
          detail?: string;
        }

        const themes: ThemeOption[] = [
          // GitHub
          { label: 'GitHub Light', value: 'github-light', description: 'Official GitHub markdown styling', detail: 'GitHub' },
          { label: 'GitHub Dark', value: 'github-dark', description: 'Official GitHub dark mode', detail: 'GitHub' },

          // Water.css
          { label: 'Water Light', value: 'water-light', description: 'Modern, clean, excellent contrast', detail: 'Water.css' },
          { label: 'Water Dark', value: 'water-dark', description: 'Modern dark mode', detail: 'Water.css' },

          // Sakura
          { label: 'Sakura Light', value: 'sakura-light', description: 'Elegant default light', detail: 'Sakura' },
          { label: 'Sakura Dark', value: 'sakura-dark', description: 'Elegant dark mode', detail: 'Sakura' },
          { label: 'Sakura Vader', value: 'sakura-vader', description: 'Dark with personality', detail: 'Sakura' },
          { label: 'Sakura Pink', value: 'sakura-pink', description: 'Soft pink accents', detail: 'Sakura' },
          { label: 'Sakura Earthly', value: 'sakura-earthly', description: 'Natural earth tones', detail: 'Sakura' },

          // Pico CSS (auto-adapts to system light/dark mode)
          { label: 'Pico Amber', value: 'pico-amber', description: 'Professional with amber accents (adapts to system theme)', detail: 'Pico CSS' },
          { label: 'Pico Blue', value: 'pico-blue', description: 'Professional with blue accents (adapts to system theme)', detail: 'Pico CSS' },
          { label: 'Pico Cyan', value: 'pico-cyan', description: 'Professional with cyan accents (adapts to system theme)', detail: 'Pico CSS' },
          { label: 'Pico Green', value: 'pico-green', description: 'Professional with green accents (adapts to system theme)', detail: 'Pico CSS' },
          { label: 'Pico Grey', value: 'pico-grey', description: 'Professional neutral grey (adapts to system theme)', detail: 'Pico CSS' },
          { label: 'Pico Pink', value: 'pico-pink', description: 'Professional with pink accents (adapts to system theme)', detail: 'Pico CSS' },
          { label: 'Pico Purple', value: 'pico-purple', description: 'Professional with purple accents (adapts to system theme)', detail: 'Pico CSS' },
          { label: 'Pico Red', value: 'pico-red', description: 'Professional with red accents (adapts to system theme)', detail: 'Pico CSS' },

          // Simple.css (auto-adapts to system light/dark mode)
          { label: 'Simple', value: 'simple', description: 'Minimalist and clean (adapts to system theme)', detail: 'Simple.css' },

          // Matcha
          { label: 'Matcha', value: 'matcha', description: 'Code-focused with excellent syntax highlighting', detail: 'Matcha' },

          // LaTeX.css
          { label: 'LaTeX', value: 'latex', description: 'Academic paper styling inspired by LaTeX', detail: 'LaTeX.css' },

          // Tufte CSS
          { label: 'Tufte', value: 'tufte', description: 'Inspired by Edward Tufte\'s design principles', detail: 'Tufte CSS' },

          // New.css
          { label: 'New', value: 'new', description: 'Modern minimal design (4k+ GitHub stars)', detail: 'New.css' }
        ];

        // Mark current theme
        const items = themes.map((t) => ({
          ...t,
          label: t.value === currentTheme ? `${t.label} $(check)` : t.label,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: `Current: ${currentTheme} - Select a theme`,
          title: 'Commentary: Select Theme',
          matchOnDescription: true,
          matchOnDetail: true
        });

        if (selected) {
          // Update configuration
          await config.update('name', selected.value, vscode.ConfigurationTarget.Workspace);

          // Refresh all webviews to apply new theme (regenerates HTML with new CSS)
          await this.webviewProvider.refreshAllWebviews();

          vscode.window.showInformationMessage(`Theme switched to: ${selected.label.replace(' $(check)', '')}`);
        }
      })
    );
  }
}
