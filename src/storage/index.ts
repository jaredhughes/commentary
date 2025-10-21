/**
 * Storage abstraction layer
 */

import * as vscode from 'vscode';
import { ICommentStorage, Note } from '../types';
import { WorkspaceStorage } from './workspaceStorage';
import { SidecarStorage } from './sidecarStorage';

export class StorageManager {
  private storage: ICommentStorage;

  constructor(
    private context: vscode.ExtensionContext,
    private workspaceRoot: vscode.Uri | undefined
  ) {
    this.storage = this.createStorage();

    // Watch for configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('commentary.storage.mode')) {
        this.storage = this.createStorage();
      }
    });
  }

  private createStorage(): ICommentStorage {
    const config = vscode.workspace.getConfiguration('commentary');
    const mode = config.get<'workspace' | 'sidecar'>('storage.mode', 'workspace');

    if (mode === 'sidecar' && this.workspaceRoot) {
      return new SidecarStorage(this.workspaceRoot);
    }

    return new WorkspaceStorage(this.context);
  }

  /**
   * Get all notes for a specific file
   */
  async getNotes(fileUri: string): Promise<Note[]> {
    return this.storage.getNotes(fileUri);
  }

  /**
   * Save a note
   */
  async saveNote(note: Note): Promise<void> {
    console.log('[StorageManager] Saving note:', note);
    await this.storage.saveNote(note);
    console.log('[StorageManager] Note saved successfully');

    // Verify it was saved
    const notes = await this.storage.getNotes(note.file);
    console.log('[StorageManager] Total notes for file:', notes.length);
  }

  /**
   * Delete a specific note
   */
  async deleteNote(noteId: string, fileUri: string): Promise<void> {
    await this.storage.deleteNote(noteId, fileUri);
  }

  /**
   * Delete all notes for a file
   */
  async deleteAllNotes(fileUri: string): Promise<void> {
    await this.storage.deleteAllNotes(fileUri);
  }

  /**
   * Get all notes across all files
   */
  async getAllNotes(): Promise<Map<string, Note[]>> {
    return this.storage.getAllNotes();
  }

  /**
   * Export all notes as JSON
   */
  async exportNotes(): Promise<string> {
    return this.storage.exportNotes();
  }

  /**
   * Import notes from JSON
   */
  async importNotes(data: string): Promise<void> {
    await this.storage.importNotes(data);
  }
}

export { ICommentStorage, WorkspaceStorage, SidecarStorage };
