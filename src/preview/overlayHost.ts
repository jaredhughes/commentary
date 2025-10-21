/**
 * Host-side controller for preview overlay
 * Manages communication with the preview script and coordinates with storage
 */

import * as vscode from 'vscode';
import { MessageHandler, PreviewBridge } from '../messaging';
import { StorageManager } from '../storage';
import { MessageType, SaveCommentMessage, DeleteCommentMessage, Note } from '../types';

export class OverlayHost {
  private messageHandler: MessageHandler;
  private previewBridge: PreviewBridge;
  private onNotesChangedEmitter = new vscode.EventEmitter<void>();

  public readonly onNotesChanged = this.onNotesChangedEmitter.event;

  constructor(
    private context: vscode.ExtensionContext,
    private storage: StorageManager
  ) {
    this.messageHandler = new MessageHandler();
    this.previewBridge = new PreviewBridge(context.extensionUri);

    this.setupMessageHandlers();
    this.setupMarkdownPreviewListener();
  }

  private setupMessageHandlers(): void {
    // Handle save comment
    this.messageHandler.on(MessageType.SaveComment, async (msg: SaveCommentMessage) => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
        return;
      }

      const note: Note = {
        id: this.generateId(),
        file: activeEditor.document.uri.toString(),
        quote: msg.selection.quote,
        position: msg.selection.position,
        text: msg.commentText,
        createdAt: new Date().toISOString(),
      };

      await this.storage.saveNote(note);
      await this.refreshPreview();
      this.onNotesChangedEmitter.fire();
    });

    // Handle delete comment
    this.messageHandler.on(MessageType.DeleteComment, async (msg: DeleteCommentMessage) => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
        return;
      }

      await this.storage.deleteNote(msg.noteId, activeEditor.document.uri.toString());
      await this.previewBridge.removeHighlight(msg.noteId);
      this.onNotesChangedEmitter.fire();
    });

    // Handle ready message (preview loaded)
    this.messageHandler.on(MessageType.Ready, async () => {
      await this.refreshPreview();
    });
  }

  private setupMarkdownPreviewListener(): void {
    // Listen for markdown preview API messages
    const disposable = vscode.commands.registerCommand(
      '_commentary.receivePreviewMessage',
      async (message: any) => {
        await this.messageHandler.handleMessage(message);
      }
    );

    this.context.subscriptions.push(disposable);

    // Register as markdown preview extension
    const textDocumentDisposable = vscode.workspace.onDidChangeTextDocument(async (e) => {
      if (e.document.languageId === 'markdown') {
        // Refresh highlights when document changes
        await this.refreshPreview();
      }
    });

    this.context.subscriptions.push(textDocumentDisposable);
  }

  /**
   * Refresh highlights in the current preview
   */
  async refreshPreview(): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
      return;
    }

    const notes = await this.storage.getNotes(activeEditor.document.uri.toString());
    await this.previewBridge.paintHighlights(notes);
  }

  /**
   * Scroll to a specific comment in the preview
   */
  async revealComment(noteId: string): Promise<void> {
    await this.previewBridge.scrollToHighlight(noteId);
  }

  /**
   * Clear all highlights from preview
   */
  async clearAllHighlights(): Promise<void> {
    await this.previewBridge.clearAllHighlights();
  }

  private generateId(): string {
    return `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  dispose(): void {
    this.messageHandler.clear();
  }
}
