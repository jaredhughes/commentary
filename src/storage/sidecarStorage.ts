/**
 * Sidecar file storage
 * Comments are stored in .comments/ folder as JSON files (shareable via git)
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ICommentStorage, Note } from '../types';

const COMMENTS_DIR = '.comments';

export class SidecarStorage implements ICommentStorage {
  constructor(private workspaceRoot: vscode.Uri) {}

  private getCommentsDir(): vscode.Uri {
    return vscode.Uri.joinPath(this.workspaceRoot, COMMENTS_DIR);
  }

  private getCommentFilePath(fileUri: string): vscode.Uri {
    // Convert file URI to relative path and create corresponding .json file
    const relativePath = vscode.workspace.asRelativePath(fileUri);
    const commentFileName = relativePath.replace(/\//g, '_').replace(/\\/g, '_') + '.json';
    return vscode.Uri.joinPath(this.getCommentsDir(), commentFileName);
  }

  private async ensureCommentsDirExists(): Promise<void> {
    const dir = this.getCommentsDir();
    try {
      await vscode.workspace.fs.stat(dir);
    } catch {
      await vscode.workspace.fs.createDirectory(dir);
    }
  }

  async getNotes(fileUri: string): Promise<Note[]> {
    const filePath = this.getCommentFilePath(fileUri);

    try {
      const content = await vscode.workspace.fs.readFile(filePath);
      const text = Buffer.from(content).toString('utf8');
      return JSON.parse(text) as Note[];
    } catch {
      return [];
    }
  }

  async saveNote(note: Note): Promise<void> {
    await this.ensureCommentsDirExists();

    const notes = await this.getNotes(note.file);
    const index = notes.findIndex((n) => n.id === note.id);

    if (index >= 0) {
      notes[index] = note;
    } else {
      notes.push(note);
    }

    const filePath = this.getCommentFilePath(note.file);
    const content = Buffer.from(JSON.stringify(notes, null, 2), 'utf8');
    await vscode.workspace.fs.writeFile(filePath, content);
  }

  async deleteNote(noteId: string, fileUri: string): Promise<void> {
    const notes = await this.getNotes(fileUri);
    const filtered = notes.filter((n) => n.id !== noteId);

    if (filtered.length === 0) {
      // Delete the file if no notes remain
      const filePath = this.getCommentFilePath(fileUri);
      try {
        await vscode.workspace.fs.delete(filePath);
      } catch {
        // File might not exist, ignore
      }
    } else {
      const filePath = this.getCommentFilePath(fileUri);
      const content = Buffer.from(JSON.stringify(filtered, null, 2), 'utf8');
      await vscode.workspace.fs.writeFile(filePath, content);
    }
  }

  async deleteAllNotes(fileUri: string): Promise<void> {
    const filePath = this.getCommentFilePath(fileUri);
    try {
      await vscode.workspace.fs.delete(filePath);
    } catch {
      // File might not exist, ignore
    }
  }

  async getAllNotes(): Promise<Map<string, Note[]>> {
    const result = new Map<string, Note[]>();

    try {
      const dir = this.getCommentsDir();
      const entries = await vscode.workspace.fs.readDirectory(dir);

      for (const [filename, type] of entries) {
        if (type === vscode.FileType.File && filename.endsWith('.json')) {
          const filePath = vscode.Uri.joinPath(dir, filename);
          const content = await vscode.workspace.fs.readFile(filePath);
          const text = Buffer.from(content).toString('utf8');
          const notes = JSON.parse(text) as Note[];

          if (notes.length > 0) {
            result.set(notes[0].file, notes);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist yet, return empty map
      console.log('[SidecarStorage] getAllNotes error:', error);
    }

    return result;
  }

  async exportNotes(): Promise<string> {
    const allNotes = await this.getAllNotes();
    const obj = Object.fromEntries(allNotes);
    return JSON.stringify(obj, null, 2);
  }

  async importNotes(data: string): Promise<void> {
    await this.ensureCommentsDirExists();

    try {
      const parsed = JSON.parse(data) as Record<string, Note[]>;

      for (const [fileUri, notes] of Object.entries(parsed)) {
        for (const note of notes) {
          await this.saveNote(note);
        }
      }
    } catch (error) {
      throw new Error(`Failed to import notes: ${error}`);
    }
  }
}
