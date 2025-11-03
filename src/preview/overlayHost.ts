/**
 * Host-side controller for preview overlay
 * Manages communication with the preview script and coordinates with storage
 */

import * as vscode from 'vscode';
import { MessageHandler } from '../messaging';
import { StorageManager } from '../storage';
import {
  MessageType,
  SaveCommentMessage,
  SaveAndSubmitToAgentMessage,
  UpdateCommentMessage,
  DeleteCommentMessage,
  EditHighlightCommentMessage,
  SendToAgentMessage,
  UpdateDocumentTextMessage,
  Note,
  PreviewMessage
} from '../types';

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
  async handlePreviewMessage(message: PreviewMessage, documentUri: string, panel: vscode.WebviewPanel): Promise<void> {
    console.log('OverlayHost handling message:', message, 'for document:', documentUri);

    // CRITICAL: Add documentUri to the message so handlers can use it
    const messageWithUri = { ...message, documentUri } as unknown as PreviewMessage;

    await this.messageHandler.handleMessage(messageWithUri);

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

      // If this is a document-level comment, check if one already exists
      if (msg.isDocumentLevel) {
        const existingNotes = await this.storage.getNotes(documentUri);
        const existingDocComment = existingNotes.find(n => n.isDocumentLevel);

        if (existingDocComment) {
          // Update the existing document-level comment instead of creating a new one
          existingDocComment.text = msg.commentText;
          existingDocComment.createdAt = new Date().toISOString();
          console.log('Updating existing document comment:', existingDocComment);
          await this.storage.saveNote(existingDocComment);

          const panel = this.webviewPanels.get(documentUri);
          if (panel) {
            await this.refreshPreviewForDocument(documentUri, panel);
          }

          this.onNotesChangedEmitter.fire();
          return;
        }
      }

      const note: Note = {
        id: this.generateId(),
        file: documentUri,
        quote: msg.selection.quote,
        position: msg.selection.position,
        text: msg.commentText,
        createdAt: new Date().toISOString(),
        isDocumentLevel: msg.isDocumentLevel || false,
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

    // Handle save and submit to agent (atomic operation)
    this.messageHandler.on(MessageType.SaveAndSubmitToAgent, async (msg: SaveAndSubmitToAgentMessage) => {
      console.log('SaveAndSubmitToAgent handler called with:', msg);

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
        console.error('No document URI found for saving and submitting comment');
        return;
      }

      let noteId: string;
      let note: Note;

      // Check if this is editing an existing note or creating a new one
      if (msg.noteId) {
        // Editing existing comment
        const notes = await this.storage.getNotes(documentUri);
        const existingNote = notes.find(n => n.id === msg.noteId);

        if (existingNote) {
          existingNote.text = msg.commentText;
          await this.storage.saveNote(existingNote);
          note = existingNote;
          noteId = msg.noteId;
          console.log('Updated existing note:', noteId);
        } else {
          console.error('Note not found for editing:', msg.noteId);
          vscode.window.showErrorMessage('Comment not found');
          return;
        }
      } else {
        // Creating new comment
        // If this is a document-level comment, check if one already exists
        if (msg.isDocumentLevel) {
          const existingNotes = await this.storage.getNotes(documentUri);
          const existingDocComment = existingNotes.find(n => n.isDocumentLevel);

          if (existingDocComment) {
            // Update the existing document-level comment
            existingDocComment.text = msg.commentText;
            existingDocComment.createdAt = new Date().toISOString();
            await this.storage.saveNote(existingDocComment);
            note = existingDocComment;
            noteId = existingDocComment.id;
            console.log('Updated existing document comment:', noteId);
          } else {
            // Create new document comment
            note = {
              id: this.generateId(),
              file: documentUri,
              quote: msg.selection.quote,
              position: msg.selection.position,
              text: msg.commentText,
              createdAt: new Date().toISOString(),
              isDocumentLevel: true,
            };
            await this.storage.saveNote(note);
            noteId = note.id;
            console.log('Created new document comment:', noteId);
          }
        } else {
          // Create new regular comment
          note = {
            id: this.generateId(),
            file: documentUri,
            quote: msg.selection.quote,
            position: msg.selection.position,
            text: msg.commentText,
            createdAt: new Date().toISOString(),
            isDocumentLevel: false,
          };
          await this.storage.saveNote(note);
          noteId = note.id;
          console.log('Created new comment:', noteId);
        }
      }

      // Refresh the preview
      const panel = this.webviewPanels.get(documentUri);
      if (panel) {
        await this.refreshPreviewForDocument(documentUri, panel);
      }

      this.onNotesChangedEmitter.fire();

      // Now send to agent
      console.log('Sending note to agent:', noteId);
      await vscode.commands.executeCommand('commentary.sendToAgent', { note });
    });

    // Handle delete comment
    this.messageHandler.on(MessageType.DeleteComment, async (msg: DeleteCommentMessage & { documentUri?: string }) => {
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
        console.error('No document URI found for deleting comment');
        return;
      }

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

    // Handle add document comment (from floating button)
    this.messageHandler.on(MessageType.AddDocumentComment, async (msg: PreviewMessage & { documentUri?: string }) => {
      console.log('AddDocumentComment handler called');

      // Get document URI
      let documentUri = msg.documentUri;
      if (!documentUri) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.languageId === 'markdown') {
          documentUri = activeEditor.document.uri.toString();
        }
      }

      if (!documentUri) {
        console.error('No document URI found for adding document comment');
        return;
      }

      // Check if a document-level comment already exists
      const existingNotes = await this.storage.getNotes(documentUri);
      const existingDocComment = existingNotes.find(n => n.isDocumentLevel);

      const panel = this.webviewPanels.get(documentUri);
      if (!panel) {
        console.error('No webview panel found for document:', documentUri);
        return;
      }

      if (existingDocComment) {
        // Edit the existing document comment
        console.log('Found existing document comment, opening for edit:', existingDocComment);
        await panel.webview.postMessage({
          type: 'showEditBubbleForDocument',
          note: existingDocComment,
        });
      } else {
        // Show the bubble to create a new document comment
        console.log('No existing document comment, showing new comment bubble');
        await panel.webview.postMessage({
          type: 'showNewDocumentBubble',
        });
      }
    });

    // Handle edit highlight comment request
    this.messageHandler.on(MessageType.EditHighlightComment, async (msg: EditHighlightCommentMessage) => {
      console.log('EditHighlightComment handler called for note:', msg.noteId);

      // Get document URI from message or fall back to active editor
      let documentUri: string | undefined = msg.documentUri;
      if (!documentUri) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.languageId === 'markdown') {
          documentUri = activeEditor.document.uri.toString();
        }
      }

      if (!documentUri) {
        console.error('No document URI found for editing comment');
        return;
      }

      // Get all notes and find the one with matching ID
      const notes = await this.storage.getNotes(documentUri);
      const note = notes.find(n => n.id === msg.noteId);

      if (note) {
        const panel = this.webviewPanels.get(documentUri);
        if (panel) {
          await panel.webview.postMessage({
            type: 'showEditBubble',
            note: note,
            shouldScroll: false, // Don't scroll when clicked on highlight itself
          });
        }
      } else {
        console.error('Note not found:', msg.noteId);
      }
    });

    // Handle update comment
    this.messageHandler.on(MessageType.UpdateComment, async (msg: UpdateCommentMessage) => {
      console.log('UpdateComment handler called:', msg);

      const documentUri = msg.documentUri;
      if (documentUri) {
        const notes = await this.storage.getNotes(documentUri);
        const note = notes.find(n => n.id === msg.noteId);

        if (note) {
          note.text = msg.commentText;
          await this.storage.saveNote(note);

          const panel = this.webviewPanels.get(documentUri);
          if (panel) {
            await this.refreshPreviewForDocument(documentUri, panel);
          }

          this.onNotesChangedEmitter.fire();
        }
      }
    });

    // Handle send to agent (from webview "Submit to agent" button)
    this.messageHandler.on(MessageType.SendToAgent, async (msg: SendToAgentMessage) => {
      console.log('SendToAgent handler called:', msg);

      // Get document URI
      let documentUri = msg.documentUri;
      if (!documentUri) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.languageId === 'markdown') {
          documentUri = activeEditor.document.uri.toString();
        }
      }

      if (!documentUri) {
        console.error('No document URI found for sending to agent');
        return;
      }

      // Get the note
      const notes = await this.storage.getNotes(documentUri);
      const note = notes.find(n => n.id === msg.noteId);

      if (!note) {
        console.error('Note not found:', msg.noteId);
        vscode.window.showErrorMessage('Comment not found');
        return;
      }

      // Send to agent via command
      await vscode.commands.executeCommand('commentary.sendToAgent', { note });
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
