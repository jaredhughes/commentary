/**
 * Workspace-based storage (VS Code Memento API)
 * Comments are stored in workspace state and not tracked by git
 */

import * as vscode from 'vscode';
import { ICommentStorage, Note } from '../types';

const STORAGE_KEY = 'commentary.notes';

export class WorkspaceStorage implements ICommentStorage {
  constructor(private context: vscode.ExtensionContext) {}

  private async getAllStoredNotes(): Promise<Map<string, Note[]>> {
    const stored = this.context.workspaceState.get<Record<string, Note[]>>(STORAGE_KEY, {});
    return new Map(Object.entries(stored));
  }

  private async saveAllNotes(notes: Map<string, Note[]>): Promise<void> {
    const obj = Object.fromEntries(notes);
    await this.context.workspaceState.update(STORAGE_KEY, obj);
  }

  async getNotes(fileUri: string): Promise<Note[]> {
    const allNotes = await this.getAllStoredNotes();
    return allNotes.get(fileUri) || [];
  }

  async saveNote(note: Note): Promise<void> {
    console.log('[WorkspaceStorage] saveNote called with:', note);
    const allNotes = await this.getAllStoredNotes();
    console.log('[WorkspaceStorage] Current notes in storage:', allNotes.size, 'files');
    const fileNotes = allNotes.get(note.file) || [];
    console.log('[WorkspaceStorage] Current notes for file:', fileNotes.length);

    // Replace if exists, otherwise append
    const index = fileNotes.findIndex((n) => n.id === note.id);
    if (index >= 0) {
      console.log('[WorkspaceStorage] Replacing existing note at index', index);
      fileNotes[index] = note;
    } else {
      console.log('[WorkspaceStorage] Appending new note');
      fileNotes.push(note);
    }

    allNotes.set(note.file, fileNotes);
    console.log('[WorkspaceStorage] Saving to workspace state...');
    await this.saveAllNotes(allNotes);
    console.log('[WorkspaceStorage] Save complete. Total notes for file now:', fileNotes.length);
  }

  async deleteNote(noteId: string, fileUri: string): Promise<void> {
    const allNotes = await this.getAllStoredNotes();
    const fileNotes = allNotes.get(fileUri) || [];
    const filtered = fileNotes.filter((n) => n.id !== noteId);

    if (filtered.length === 0) {
      allNotes.delete(fileUri);
    } else {
      allNotes.set(fileUri, filtered);
    }

    await this.saveAllNotes(allNotes);
  }

  async deleteAllNotes(fileUri: string): Promise<void> {
    const allNotes = await this.getAllStoredNotes();
    allNotes.delete(fileUri);
    await this.saveAllNotes(allNotes);
  }

  async getAllNotes(): Promise<Map<string, Note[]>> {
    console.log('[WorkspaceStorage] getAllNotes called');
    const notes = await this.getAllStoredNotes();
    console.log('[WorkspaceStorage] Returning', notes.size, 'files with notes');
    for (const [fileUri, fileNotes] of notes.entries()) {
      console.log('[WorkspaceStorage]  -', fileUri, ':', fileNotes.length, 'notes');
    }
    return notes;
  }

  async exportNotes(): Promise<string> {
    const allNotes = await this.getAllStoredNotes();
    const obj = Object.fromEntries(allNotes);
    return JSON.stringify(obj, null, 2);
  }

  async importNotes(data: string): Promise<void> {
    try {
      const parsed = JSON.parse(data) as Record<string, Note[]>;
      const notes = new Map(Object.entries(parsed));
      await this.saveAllNotes(notes);
    } catch (error) {
      throw new Error(`Failed to import notes: ${error}`);
    }
  }
}
