/**
 * Pure helpers for the direct Claude API integration.
 * No vscode dependency so the logic is unit-testable.
 */

export interface ClaudeTextResponse {
  stop_reason?: string | null;
  content: ReadonlyArray<{ type: string; text?: string }>;
}

export type ExtractedContent =
  | { ok: true; text: string }
  | { ok: false; reason: 'truncated' };

/**
 * Extract the editable document text from a Claude response, refusing to do so
 * when the response was cut off at the output-token limit. The caller replaces
 * the ENTIRE document with this text, so applying a truncated response would
 * silently destroy content — return ok:false instead and let the caller abort.
 */
export function extractEditableContent(response: ClaudeTextResponse): ExtractedContent {
  if (response.stop_reason === 'max_tokens') {
    return { ok: false, reason: 'truncated' };
  }
  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n');
  return { ok: true, text };
}
