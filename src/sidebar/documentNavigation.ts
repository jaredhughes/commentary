/**
 * Service for handling document navigation and comment reveal operations
 * Extracted from commands.ts for better testability and maintainability
 */

import * as vscode from 'vscode';
import { Note } from '../types';
import { MarkdownWebviewProvider } from '../preview/markdownWebview';
import { OverlayHost } from '../preview/overlayHost';

/**
 * Configuration for timing delays when revealing comments
 */
export interface RevealTimingConfig {
  /** Delay when opening a new document (ms) */
  newDocumentDelay: number;
  /** Delay when switching to an existing document (ms) */
  existingDocumentDelay: number;
}

/**
 * Default timing configuration optimized for webview initialization
 */
export const DEFAULT_TIMING_CONFIG: RevealTimingConfig = {
  newDocumentDelay: 1000,
  existingDocumentDelay: 500,
};

/**
 * Service for navigating to documents and revealing comments
 */
export class DocumentNavigationService {
  constructor(
    private webviewProvider: MarkdownWebviewProvider,
    private overlayHost: OverlayHost,
    private timingConfig: RevealTimingConfig = DEFAULT_TIMING_CONFIG
  ) {}

  /**
   * Get webview panels map from OverlayHost
   * This is a workaround for accessing private members - ideally OverlayHost would expose this
   */
  private getWebviewPanels(): Map<string, vscode.WebviewPanel> {
    return (this.overlayHost as unknown as { webviewPanels: Map<string, vscode.WebviewPanel> }).webviewPanels;
  }

  /**
   * Open or reveal a document in the webview
   * @returns The webview panel for the document, or undefined if failed
   */
  async ensureDocumentOpen(documentUri: string): Promise<vscode.WebviewPanel | undefined> {
    const panels = this.getWebviewPanels();
    const existingPanel = panels.get(documentUri);

    if (existingPanel) {
      // Document already open - reveal it
      existingPanel.reveal(vscode.ViewColumn.One, false); // false = don't preserve focus
      return existingPanel;
    }

    // Document not open - open it
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(documentUri));
      await this.webviewProvider.openMarkdown(doc);
      return panels.get(documentUri);
    } catch (error) {
      console.error('[DocumentNavigationService] Failed to open document:', error);
      return undefined;
    }
  }

  /**
   * Wait for a document's webview to be ready
   * @param documentUri The document URI
   * @param wasAlreadyOpen Whether the document was already open (affects delay)
   */
  async waitForDocumentReady(documentUri: string, wasAlreadyOpen: boolean): Promise<void> {
    const delay = wasAlreadyOpen
      ? this.timingConfig.existingDocumentDelay
      : this.timingConfig.newDocumentDelay;

    console.log(
      `[DocumentNavigationService] Waiting ${delay}ms for document to be ready (wasAlreadyOpen: ${wasAlreadyOpen})`
    );

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Show an edit bubble for a comment
   * @param documentUri The document containing the comment
   * @param note The note to edit
   * @param shouldScroll Whether to scroll the highlight into view
   */
  async showEditBubbleForComment(
    documentUri: string,
    note: Note,
    shouldScroll: boolean = true
  ): Promise<boolean> {
    const panels = this.getWebviewPanels();
    const panel = panels.get(documentUri);

    if (!panel) {
      console.error('[DocumentNavigationService] No panel found for document:', documentUri);
      return false;
    }

    // Determine message type based on comment type
    const messageType = note.isDocumentLevel ? 'showEditBubbleForDocument' : 'showEditBubble';

    try {
      await panel.webview.postMessage({
        type: messageType,
        note: note,
        shouldScroll: shouldScroll,
      });
      return true;
    } catch (error) {
      console.error('[DocumentNavigationService] Failed to post message to webview:', error);
      return false;
    }
  }

  /**
   * Navigate to a comment and show its edit bubble
   * This is the high-level operation that combines all the steps
   */
  async navigateToComment(note: Note, shouldScroll: boolean = true): Promise<boolean> {
    const documentUri = note.file;
    const panels = this.getWebviewPanels();
    const wasAlreadyOpen = panels.has(documentUri);

    // Step 1: Ensure document is open
    const panel = await this.ensureDocumentOpen(documentUri);
    if (!panel) {
      vscode.window.showErrorMessage('Failed to open document');
      return false;
    }

    // Step 2: Wait for webview to be ready
    await this.waitForDocumentReady(documentUri, wasAlreadyOpen);

    // Step 3: Show the edit bubble
    const success = await this.showEditBubbleForComment(documentUri, note, shouldScroll);
    if (!success) {
      vscode.window.showWarningMessage('Failed to show comment');
    }

    return success;
  }

  /**
   * Open a document without revealing any specific comment
   */
  async openDocument(fileUri: string): Promise<void> {
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(fileUri));
      await this.webviewProvider.openMarkdown(doc);
    } catch (error) {
      console.error('[DocumentNavigationService] Failed to open document:', error);
      vscode.window.showErrorMessage(`Failed to open document: ${error}`);
    }
  }
}
