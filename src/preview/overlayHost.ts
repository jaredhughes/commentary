/**
 * Host-side controller for preview overlay
 * Manages communication with the preview script and coordinates with storage
 */

import * as vscode from 'vscode';
import { MessageHandler } from '../messaging';
import { StorageManager } from '../storage';
import { MessageType, SaveCommentMessage, DeleteCommentMessage, Note } from '../types';

export class OverlayHost {
  private messageHandler: MessageHandler;
  private onNotesChangedEmitter = new vscode.EventEmitter<void>();
  private webviewPanels: Map<string, vscode.WebviewPanel> = new Map();

  public readonly onNotesChanged = this.onNotesChangedEmitter.event;

  constructor(
    private context: vscode.ExtensionContext,
    private storage: StorageManager
  ) {
    this.messageHandler = new MessageHandler();
    this.setupMessageHandlers();
  }

  /**
   * Register a webview panel for a document
   */
  registerWebview(panel: vscode.WebviewPanel, documentUri: string): void {
    console.log('Registering webview for:', documentUri);
    this.webviewPanels.set(documentUri, panel);

    // Unregister when panel is closed
    panel.onDidDispose(() => {
      this.webviewPanels.delete(documentUri);
    });

    // Load and paint existing comments
    this.refreshPreviewForDocument(documentUri, panel);
  }

  /**
   * Handle message from preview webview
   */
  async handlePreviewMessage(message: any, documentUri: string, panel: vscode.WebviewPanel): Promise<void> {
    console.log('OverlayHost handling message:', message, 'for document:', documentUri);

    // CRITICAL: Add documentUri to the message so handlers can use it
    message.documentUri = documentUri;

    await this.messageHandler.handleMessage(message);

    // After handling, refresh the preview
    await this.refreshPreviewForDocument(documentUri, panel);
  }

  private setupMessageHandlers(): void {
    // Handle save comment
    this.messageHandler.on(MessageType.SaveComment, async (msg: SaveCommentMessage) => {
      console.log('SaveComment handler called with:', msg);

      // Get document URI from the message or fall back to active editor
      let documentUri: string | undefined;
      if (msg.documentUri) {
        documentUri = msg.documentUri;
      } else {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.languageId === 'markdown') {
          documentUri = activeEditor.document.uri.toString();
        }
      }

      if (!documentUri) {
        console.error('No document URI found for saving comment');
        return;
      }

      const note: Note = {
        id: this.generateId(),
        file: documentUri,
        quote: msg.selection.quote,
        position: msg.selection.position,
        text: msg.commentText,
        createdAt: new Date().toISOString(),
      };

      console.log('Saving note:', note);
      await this.storage.saveNote(note);

      // Get the webview panel for this document
      const panel = this.webviewPanels.get(documentUri);
      if (panel) {
        await this.refreshPreviewForDocument(documentUri, panel);
      }

      this.onNotesChangedEmitter.fire();
    });

    // Handle delete comment
    this.messageHandler.on(MessageType.DeleteComment, async (msg: DeleteCommentMessage) => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
        return;
      }

      const documentUri = activeEditor.document.uri.toString();
      await this.storage.deleteNote(msg.noteId, documentUri);

      // Send removeHighlight message to the webview
      const panel = this.webviewPanels.get(documentUri);
      if (panel) {
        await panel.webview.postMessage({
          type: 'removeHighlight',
          noteId: msg.noteId,
        });
      }

      this.onNotesChangedEmitter.fire();
    });

    // Handle ready message (preview loaded)
    this.messageHandler.on(MessageType.Ready, async () => {
      console.log('Preview ready message received');
    });
  }

  /**
   * Refresh highlights for a specific document's webview
   */
  async refreshPreviewForDocument(documentUri: string, panel: vscode.WebviewPanel): Promise<void> {
    console.log('Refreshing preview for:', documentUri);
    const notes = await this.storage.getNotes(documentUri);
    console.log('Found notes:', notes);

    // Send message directly to the webview panel
    await panel.webview.postMessage({
      type: 'paintHighlights',
      notes: notes,
    });
  }

  /**
   * Refresh highlights in all open previews
   */
  async refreshPreview(): Promise<void> {
    for (const [documentUri, panel] of this.webviewPanels.entries()) {
      await this.refreshPreviewForDocument(documentUri, panel);
    }
  }

  /**
   * Scroll to a specific comment in the preview
   */
  async revealComment(noteId: string): Promise<void> {
    console.log('[OverlayHost] Revealing comment:', noteId);
    // Send to all open webviews
    for (const panel of this.webviewPanels.values()) {
      await panel.webview.postMessage({
        type: 'scrollToHighlight',
        noteId: noteId,
      });
    }
  }

  /**
   * Clear all highlights from preview
   */
  async clearAllHighlights(): Promise<void> {
    console.log('[OverlayHost] Clearing all highlights');
    // Send to all open webviews
    for (const panel of this.webviewPanels.values()) {
      await panel.webview.postMessage({
        type: 'clearAllHighlights',
      });
    }
  }

  private generateId(): string {
    return `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  dispose(): void {
    this.messageHandler.clear();
  }
}
