/**
 * Command handlers for Commentary extension
 */

import * as vscode from 'vscode';
import { StorageManager } from '../storage';
import { OverlayHost } from '../preview/overlayHost';
import { AgentClient } from '../agent/client';
import { CommentsViewProvider } from './commentsView';

export class CommandManager {
  constructor(
    private context: vscode.ExtensionContext,
    private storage: StorageManager,
    private overlayHost: OverlayHost,
    private commentsView: CommentsViewProvider,
    private agentClient: AgentClient
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
      vscode.commands.registerCommand('commentary.deleteComment', async (item: any) => {
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
      vscode.commands.registerCommand('commentary.sendToAgent', async (item: any) => {
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
  }
}
