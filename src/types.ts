/**
 * Core type definitions for Commentary extension
 */

export interface TextQuoteSelector {
  exact: string;
  prefix?: string;
  suffix?: string;
}

export interface TextPositionSelector {
  start: number;
  end: number;
}

export interface LineRange {
  start: number;
  end: number;
}

export interface Note {
  id: string;
  file: string;
  quote: TextQuoteSelector;
  position: TextPositionSelector;
  lines?: LineRange;
  text: string;
  createdAt: string;
}

export interface SerializedSelection {
  quote: TextQuoteSelector;
  position: TextPositionSelector;
  html?: string;
}

/**
 * Messages sent from preview overlay to extension host
 */
export enum MessageType {
  SaveComment = 'saveComment',
  DeleteComment = 'deleteComment',
  RevealComment = 'revealComment',
  SendToAgent = 'sendToAgent',
  Ready = 'ready',
  SelectionMade = 'selectionMade'
}

/**
 * Messages sent from extension host to preview overlay
 */
export enum HostMessageType {
  PaintHighlights = 'paintHighlights',
  RemoveHighlight = 'removeHighlight',
  ScrollToHighlight = 'scrollToHighlight',
  ClearAllHighlights = 'clearAllHighlights'
}

export interface BaseMessage {
  type: MessageType;
}

export interface SaveCommentMessage extends BaseMessage {
  type: MessageType.SaveComment;
  selection: SerializedSelection;
  commentText: string;
  documentUri?: string;
}

export interface DeleteCommentMessage extends BaseMessage {
  type: MessageType.DeleteComment;
  noteId: string;
}

export interface RevealCommentMessage extends BaseMessage {
  type: MessageType.RevealComment;
  noteId: string;
}

export interface SendToAgentMessage extends BaseMessage {
  type: MessageType.SendToAgent;
  noteId: string;
}

export interface ReadyMessage extends BaseMessage {
  type: MessageType.Ready;
}

export interface SelectionMadeMessage extends BaseMessage {
  type: MessageType.SelectionMade;
  selection: SerializedSelection;
}

export type PreviewMessage =
  | SaveCommentMessage
  | DeleteCommentMessage
  | RevealCommentMessage
  | SendToAgentMessage
  | ReadyMessage
  | SelectionMadeMessage;

export interface BaseHostMessage {
  type: HostMessageType;
}

export interface PaintHighlightsMessage extends BaseHostMessage {
  type: HostMessageType.PaintHighlights;
  notes: Note[];
}

export interface RemoveHighlightMessage extends BaseHostMessage {
  type: HostMessageType.RemoveHighlight;
  noteId: string;
}

export interface ScrollToHighlightMessage extends BaseHostMessage {
  type: HostMessageType.ScrollToHighlight;
  noteId: string;
}

export interface ClearAllHighlightsMessage extends BaseHostMessage {
  type: HostMessageType.ClearAllHighlights;
}

export type HostMessage =
  | PaintHighlightsMessage
  | RemoveHighlightMessage
  | ScrollToHighlightMessage
  | ClearAllHighlightsMessage;

/**
 * Storage interface
 */
export interface ICommentStorage {
  getNotes(fileUri: string): Promise<Note[]>;
  saveNote(note: Note): Promise<void>;
  deleteNote(noteId: string, fileUri: string): Promise<void>;
  deleteAllNotes(fileUri: string): Promise<void>;
  getAllNotes(): Promise<Map<string, Note[]>>;
  exportNotes(): Promise<string>;
  importNotes(data: string): Promise<void>;
}

/**
 * Agent request/response types
 */
export interface AgentContext {
  note: Note;
  contextBefore: string;
  contextAfter: string;
  fullDocument?: string;
}

export interface AgentRequest {
  contexts: AgentContext[];
  instruction?: string;
}

export interface AgentResponse {
  suggestions: Array<{
    noteId: string;
    suggestion: string;
    edit?: {
      range: LineRange;
      newText: string;
    };
  }>;
}
