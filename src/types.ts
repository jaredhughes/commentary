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
  isDocumentLevel?: boolean; // True if comment applies to entire document
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
  SaveAndSubmitToAgent = 'saveAndSubmitToAgent',
  UpdateComment = 'updateComment',
  DeleteComment = 'deleteComment',
  EditHighlightComment = 'editHighlightComment',
  RevealComment = 'revealComment',
  SendToAgent = 'sendToAgent',
  Ready = 'ready',
  SelectionMade = 'selectionMade',
  AddDocumentComment = 'addDocumentComment',
  UpdateDocumentText = 'updateDocumentText'
}

/**
 * Messages sent from extension host to preview overlay
 */
export enum HostMessageType {
  PaintHighlights = 'paintHighlights',
  RemoveHighlight = 'removeHighlight',
  ScrollToHighlight = 'scrollToHighlight',
  ClearAllHighlights = 'clearAllHighlights',
  ShowEditBubble = 'showEditBubble'
}

export interface BaseMessage {
  type: MessageType;
}

export interface SaveCommentMessage extends BaseMessage {
  type: MessageType.SaveComment;
  selection: SerializedSelection;
  commentText: string;
  documentUri?: string;
  isDocumentLevel?: boolean;
}

export interface SaveAndSubmitToAgentMessage extends BaseMessage {
  type: MessageType.SaveAndSubmitToAgent;
  selection: SerializedSelection;
  commentText: string;
  documentUri?: string;
  isDocumentLevel?: boolean;
  noteId?: string; // For editing existing comments
}

export interface UpdateCommentMessage extends BaseMessage {
  type: MessageType.UpdateComment;
  noteId: string;
  commentText: string;
  documentUri?: string;
}

export interface DeleteCommentMessage extends BaseMessage {
  type: MessageType.DeleteComment;
  noteId: string;
}

export interface EditHighlightCommentMessage extends BaseMessage {
  type: MessageType.EditHighlightComment;
  noteId: string;
  documentUri?: string;
}

export interface RevealCommentMessage extends BaseMessage {
  type: MessageType.RevealComment;
  noteId: string;
}

export interface SendToAgentMessage extends BaseMessage {
  type: MessageType.SendToAgent;
  noteId: string;
  documentUri?: string;
}

export interface ReadyMessage extends BaseMessage {
  type: MessageType.Ready;
}

export interface SelectionMadeMessage extends BaseMessage {
  type: MessageType.SelectionMade;
  selection: SerializedSelection;
}

export interface AddDocumentCommentMessage extends BaseMessage {
  type: MessageType.AddDocumentComment;
}

export interface UpdateDocumentTextMessage extends BaseMessage {
  type: MessageType.UpdateDocumentText;
  oldText: string;
  newText: string;
}

export type PreviewMessage =
  | SaveCommentMessage
  | SaveAndSubmitToAgentMessage
  | UpdateCommentMessage
  | DeleteCommentMessage
  | EditHighlightCommentMessage
  | RevealCommentMessage
  | SendToAgentMessage
  | ReadyMessage
  | SelectionMadeMessage
  | AddDocumentCommentMessage
  | UpdateDocumentTextMessage;

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

export interface ShowEditBubbleMessage extends BaseHostMessage {
  type: HostMessageType.ShowEditBubble;
  note: Note;
}

export type HostMessage =
  | PaintHighlightsMessage
  | RemoveHighlightMessage
  | ScrollToHighlightMessage
  | ClearAllHighlightsMessage
  | ShowEditBubbleMessage;

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
