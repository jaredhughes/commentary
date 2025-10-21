/**
 * Messaging protocol between preview overlay and extension host
 */

import * as vscode from 'vscode';
import { PreviewMessage, HostMessage, MessageType, HostMessageType } from './types';

export class MessageHandler {
  private listeners: Map<MessageType, Array<(message: any) => void>> = new Map();

  /**
   * Register a listener for a specific message type
   */
  on<T extends PreviewMessage>(
    type: T['type'],
    handler: (message: T) => void | Promise<void>
  ): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(handler);
  }

  /**
   * Handle incoming message from preview
   */
  async handleMessage(message: PreviewMessage): Promise<void> {
    const handlers = this.listeners.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        await handler(message);
      }
    }
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
  }
}

/**
 * Bridge for sending messages to preview webview
 */
export class PreviewBridge {
  constructor(private extensionUri: vscode.Uri) {}

  /**
   * Send a message to all markdown preview webviews
   */
  async sendToPreview(message: HostMessage): Promise<void> {
    // Use the markdown preview custom editor API
    await vscode.commands.executeCommand('markdown.api.postMessage', message);
  }

  /**
   * Paint highlights in the preview
   */
  async paintHighlights(notes: any[]): Promise<void> {
    await this.sendToPreview({
      type: HostMessageType.PaintHighlights,
      notes,
    });
  }

  /**
   * Remove a specific highlight
   */
  async removeHighlight(noteId: string): Promise<void> {
    await this.sendToPreview({
      type: HostMessageType.RemoveHighlight,
      noteId,
    });
  }

  /**
   * Scroll to and focus a highlight
   */
  async scrollToHighlight(noteId: string): Promise<void> {
    await this.sendToPreview({
      type: HostMessageType.ScrollToHighlight,
      noteId,
    });
  }

  /**
   * Clear all highlights
   */
  async clearAllHighlights(): Promise<void> {
    await this.sendToPreview({
      type: HostMessageType.ClearAllHighlights,
    });
  }
}
