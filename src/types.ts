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

export type NotesChangedEvent =
  | { type: 'added'; note: Note }
  | { type: 'updated'; note: Note }
  | { type: 'deleted'; noteId: string; documentUri: string };

export interface SerializedSelection {
  quote: TextQuoteSelector;
  position: TextPositionSelector;
  html?: string;
}

/**
 * Messages sent from preview overlay to extension host
 */
export enum MessageType {
  saveComment = 'saveComment',
  saveAndSubmitToAgent = 'saveAndSubmitToAgent',
  updateComment = 'updateComment',
  deleteComment = 'deleteComment',
  editHighlightComment = 'editHighlightComment',
  revealComment = 'revealComment',
  sendToAgent = 'sendToAgent',
  ready = 'ready',
  selectionMade = 'selectionMade',
  addDocumentComment = 'addDocumentComment',
  updateDocumentText = 'updateDocumentText'
}

/**
 * Messages sent from extension host to preview overlay
 */
export enum HostMessageType {
  paintHighlights = 'paintHighlights',
  removeHighlight = 'removeHighlight',
  scrollToHighlight = 'scrollToHighlight',
  clearAllHighlights = 'clearAllHighlights',
  showEditBubble = 'showEditBubble',
  updateProvider = 'updateProvider'
}

export interface BaseMessage {
  type: MessageType;
}

export interface SaveCommentMessage extends BaseMessage {
  type: MessageType.saveComment;
  selection: SerializedSelection;
  commentText: string;
  documentUri?: string;
  isDocumentLevel?: boolean;
}

export interface SaveAndSubmitToAgentMessage extends BaseMessage {
  type: MessageType.saveAndSubmitToAgent;
  selection: SerializedSelection;
  commentText: string;
  documentUri?: string;
  isDocumentLevel?: boolean;
  noteId?: string; // For editing existing comments
}

export interface UpdateCommentMessage extends BaseMessage {
  type: MessageType.updateComment;
  noteId: string;
  commentText: string;
  documentUri?: string;
}

export interface DeleteCommentMessage extends BaseMessage {
  type: MessageType.deleteComment;
  noteId: string;
}

export interface EditHighlightCommentMessage extends BaseMessage {
  type: MessageType.editHighlightComment;
  noteId: string;
  documentUri?: string;
}

export interface RevealCommentMessage extends BaseMessage {
  type: MessageType.revealComment;
  noteId: string;
}

export interface SendToAgentMessage extends BaseMessage {
  type: MessageType.sendToAgent;
  noteId: string;
  documentUri?: string;
}

export interface ReadyMessage extends BaseMessage {
  type: MessageType.ready;
}

export interface SelectionMadeMessage extends BaseMessage {
  type: MessageType.selectionMade;
  selection: SerializedSelection;
}

export interface AddDocumentCommentMessage extends BaseMessage {
  type: MessageType.addDocumentComment;
}

export interface UpdateDocumentTextMessage extends BaseMessage {
  type: MessageType.updateDocumentText;
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
  type: HostMessageType.paintHighlights;
  notes: Note[];
}

export interface RemoveHighlightMessage extends BaseHostMessage {
  type: HostMessageType.removeHighlight;
  noteId: string;
}

export interface ScrollToHighlightMessage extends BaseHostMessage {
  type: HostMessageType.scrollToHighlight;
  noteId: string;
}

export interface ClearAllHighlightsMessage extends BaseHostMessage {
  type: HostMessageType.clearAllHighlights;
}

export interface ShowEditBubbleMessage extends BaseHostMessage {
  type: HostMessageType.showEditBubble;
  note: Note;
}

export interface UpdateProviderMessage extends BaseHostMessage {
  type: HostMessageType.updateProvider;
  provider: string;
}

export type HostMessage =
  | PaintHighlightsMessage
  | RemoveHighlightMessage
  | ScrollToHighlightMessage
  | ClearAllHighlightsMessage
  | ShowEditBubbleMessage
  | UpdateProviderMessage;

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
