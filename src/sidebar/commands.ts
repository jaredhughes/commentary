/**
 * Command handlers for Commentary extension
 */

import * as vscode from 'vscode';
import { StorageManager } from '../storage';
import { OverlayHost } from '../preview/overlayHost';
import { AgentClient } from '../agent/client';
import { CommentsViewProvider, CommentTreeItem } from './commentsView';
import { MarkdownWebviewProvider } from '../preview/markdownWebview';

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
    // Reveal comment in preview
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.revealComment', async (noteId: string) => {
        await this.overlayHost.revealComment(noteId);
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

    // Delete all comments
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.deleteAllComments', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
          vscode.window.showWarningMessage('No active Markdown file');
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          'Delete all comments in this file?',
          { modal: true },
          'Delete All'
        );

        if (confirm === 'Delete All') {
          await this.storage.deleteAllNotes(activeEditor.document.uri.toString());
          await this.overlayHost.clearAllHighlights();
          this.commentsView.refresh();
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

    // Send all comments to agent
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendAllToAgent', async () => {
        const notes = await this.commentsView.getActiveFileComments();

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

    // Toggle AI agent provider
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.toggleAgentProvider', async () => {
        const config = vscode.workspace.getConfiguration('commentary.agent');
        const currentProvider = config.get<string>('provider', 'cursor');

        // Define available providers
        interface ProviderOption {
          label: string;
          value: string;
          description: string;
        }

        const providers: ProviderOption[] = [
          {
            label: '$(circuit-board) Claude Code',
            value: 'claude',
            description: 'Direct CLI integration with Claude Code',
          },
          {
            label: '$(edit) Cursor',
            value: 'cursor',
            description: 'Cursor AI agent via cursor-agent CLI',
          },
          {
            label: '$(globe) OpenAI',
            value: 'openai',
            description: 'OpenAI API (requires API key)',
          },
          {
            label: '$(tools) Custom',
            value: 'custom',
            description: 'Custom endpoint (requires configuration)',
          },
        ];

        // Mark current provider
        const items = providers.map((p) => ({
          ...p,
          label: p.value === currentProvider ? `${p.label} $(check)` : p.label,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: `Current: ${currentProvider} - Select a new AI agent provider`,
          title: 'Commentary: AI Agent Provider',
        });

        if (selected) {
          const newProvider = selected.value;

          // Update configuration (workspace level for portability)
          await config.update('provider', newProvider, vscode.ConfigurationTarget.Workspace);

          // Show confirmation with helpful message
          let message = `AI agent provider switched to: ${newProvider}`;

          if (newProvider === 'openai' && !config.get<string>('apiKey')) {
            message += ' (API key required - configure in settings)';
          } else if (newProvider === 'custom' && !config.get<string>('endpoint')) {
            message += ' (endpoint required - configure in settings)';
          }

          vscode.window.showInformationMessage(message);
        }
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

          // Pico CSS
          { label: 'Pico Amber', value: 'pico-amber', description: 'Auto light/dark switching', detail: 'Pico CSS' },
          { label: 'Pico Blue', value: 'pico-blue', description: 'Auto light/dark switching', detail: 'Pico CSS' },
          { label: 'Pico Cyan', value: 'pico-cyan', description: 'Auto light/dark switching', detail: 'Pico CSS' },
          { label: 'Pico Green', value: 'pico-green', description: 'Auto light/dark switching', detail: 'Pico CSS' },
          { label: 'Pico Grey', value: 'pico-grey', description: 'Auto light/dark switching', detail: 'Pico CSS' },
          { label: 'Pico Pink', value: 'pico-pink', description: 'Auto light/dark switching', detail: 'Pico CSS' },
          { label: 'Pico Purple', value: 'pico-purple', description: 'Auto light/dark switching', detail: 'Pico CSS' },
          { label: 'Pico Red', value: 'pico-red', description: 'Auto light/dark switching', detail: 'Pico CSS' },

          // Simple.css
          { label: 'Simple', value: 'simple', description: 'Minimalist, auto dark/light switching', detail: 'Simple.css' },

          // Matcha
          { label: 'Matcha', value: 'matcha', description: 'Code-focused with excellent syntax highlighting', detail: 'Matcha' }
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

    // Toggle between light/dark theme variants
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.toggleDarkLight', async () => {
        const config = vscode.workspace.getConfiguration('commentary.theme');
        const currentTheme = config.get<string>('name', 'github-light');

        // Define theme pairs (light -> dark, dark -> light)
        const themePairs: Record<string, string> = {
          'github-light': 'github-dark',
          'github-dark': 'github-light',
          'water-light': 'water-dark',
          'water-dark': 'water-light',
          'sakura-light': 'sakura-dark',
          'sakura-dark': 'sakura-light',
          'sakura-vader': 'sakura-dark', // vader is dark, toggle to default dark
          'sakura-pink': 'sakura-light', // pink is light, toggle to default light
          'sakura-earthly': 'sakura-light', // earthly is light, toggle to default light
        };

        // Auto-switching themes don't need toggle
        const autoSwitchingThemes = [
          'pico-amber', 'pico-blue', 'pico-cyan', 'pico-green',
          'pico-grey', 'pico-pink', 'pico-purple', 'pico-red',
          'simple', 'matcha'
        ];

        if (autoSwitchingThemes.includes(currentTheme)) {
          vscode.window.showInformationMessage(
            `${currentTheme} automatically switches between light/dark based on system preferences.`
          );
          return;
        }

        const newTheme = themePairs[currentTheme];
        if (newTheme) {
          await config.update('name', newTheme, vscode.ConfigurationTarget.Workspace);
          await this.webviewProvider.refreshAllWebviews();
          vscode.window.showInformationMessage(`Theme switched to: ${newTheme}`);
        } else {
          vscode.window.showWarningMessage(`No light/dark variant available for: ${currentTheme}`);
        }
      })
    );
  }
}
