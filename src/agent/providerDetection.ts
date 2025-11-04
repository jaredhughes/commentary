/**
 * Smart provider detection
 * Automatically selects the best available agent provider based on:
 * - Editor context (Cursor vs VS Code)
 * - Available CLI tools (cursor-agent, claude)
 * - API keys configured
 * - User preferences
 *
 * Priority: CLI/API > Clipboard UI
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type DetectedProvider = 'claude' | 'cursor' | 'vscode';

export interface ProviderDetectionResult {
  provider: DetectedProvider;
  reason: string;
  capabilities: {
    hasApi: boolean;
    hasCli: boolean;
    requiresClipboard: boolean;
  };
}

/**
 * Check if a command exists in PATH
 */
async function checkCommandExists(command: string): Promise<boolean> {
  try {
    const checkCommand = process.platform === 'win32'
      ? `where ${command}`
      : `command -v ${command}`;

    await execAsync(checkCommand);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect which editor we're running in
 */
function detectEditor(): 'cursor' | 'vscode' | 'unknown' {
  const appName = vscode.env.appName.toLowerCase();

  if (appName.includes('cursor')) {
    return 'cursor';
  }

  if (appName.includes('visual studio code') || appName.includes('vscode')) {
    return 'vscode';
  }

  return 'unknown';
}

/**
 * Check if Claude API is available
 */
function hasClaudeApi(): boolean {
  const config = vscode.workspace.getConfiguration('commentary.agent');
  const apiKey = config.get<string>('apiKey');
  const envApiKey = process.env.ANTHROPIC_API_KEY;

  return !!(apiKey || envApiKey);
}

/**
 * Detect the optimal provider based on environment
 *
 * Priority order:
 * 1. API keys (best - automatic editing)
 * 2. CLI tools matching editor (good - terminal-based automatic editing)
 * 3. Generic CLI tools (good - works but not editor-native)
 * 4. Clipboard + chat UI (fallback - manual paste required)
 */
export async function detectOptimalProvider(): Promise<ProviderDetectionResult> {
  const editor = detectEditor();
  const config = vscode.workspace.getConfiguration('commentary.agent');

  // Check if user has already explicitly configured a provider
  const configuredProvider = config.inspect<string>('provider');
  if (configuredProvider?.workspaceValue || configuredProvider?.globalValue) {
    // User has made an explicit choice - respect it
    const provider = config.get<string>('provider', 'cursor') as DetectedProvider;
    return {
      provider,
      reason: 'User configured',
      capabilities: await getProviderCapabilities(provider, config)
    };
  }

  // Check API availability
  const claudeApiAvailable = hasClaudeApi();

  // Check CLI availability
  const [cursorAgentAvailable, claudeCliAvailable] = await Promise.all([
    checkCommandExists('cursor-agent'),
    checkCommandExists('claude')
  ]);

  console.log('[Commentary] Provider detection:', {
    editor,
    claudeApiAvailable,
    cursorAgentAvailable,
    claudeCliAvailable
  });

  // Priority 1: Claude API (best experience - automatic editing)
  if (claudeApiAvailable) {
    return {
      provider: 'claude',
      reason: 'Claude API key configured (automatic editing)',
      capabilities: {
        hasApi: true,
        hasCli: claudeCliAvailable,
        requiresClipboard: false
      }
    };
  }

  // Priority 2: Editor-native CLI tools
  if (editor === 'cursor' && cursorAgentAvailable) {
    return {
      provider: 'cursor',
      reason: 'Running in Cursor with cursor-agent CLI (automatic editing)',
      capabilities: {
        hasApi: false,
        hasCli: true,
        requiresClipboard: false
      }
    };
  }

  if ((editor === 'vscode' || editor === 'unknown') && claudeCliAvailable) {
    return {
      provider: 'claude',
      reason: 'Claude CLI available (automatic editing)',
      capabilities: {
        hasApi: false,
        hasCli: true,
        requiresClipboard: false
      }
    };
  }

  // Priority 3: Any available CLI tool (prefer Claude > Cursor)
  if (claudeCliAvailable) {
    return {
      provider: 'claude',
      reason: 'Claude CLI available',
      capabilities: {
        hasApi: false,
        hasCli: true,
        requiresClipboard: false
      }
    };
  }

  if (cursorAgentAvailable) {
    return {
      provider: 'cursor',
      reason: 'cursor-agent CLI available',
      capabilities: {
        hasApi: false,
        hasCli: true,
        requiresClipboard: false
      }
    };
  }

  // Priority 4: Fallback to UI clipboard methods (least preferred)
  if (editor === 'cursor') {
    return {
      provider: 'cursor',
      reason: 'Running in Cursor (clipboard method - install cursor-agent for automatic editing)',
      capabilities: {
        hasApi: false,
        hasCli: false,
        requiresClipboard: true
      }
    };
  }

  // Final fallback: Claude clipboard method
  return {
    provider: 'claude',
    reason: 'Default fallback (clipboard method - configure API key or install claude CLI for automatic editing)',
    capabilities: {
      hasApi: false,
      hasCli: false,
      requiresClipboard: true
    }
  };
}

/**
 * Get capabilities for a specific provider
 */
async function getProviderCapabilities(
  provider: DetectedProvider,
  config: vscode.WorkspaceConfiguration
): Promise<{ hasApi: boolean; hasCli: boolean; requiresClipboard: boolean }> {
  switch (provider) {
    case 'claude': {
      const hasApi = hasClaudeApi();
      const hasCli = await checkCommandExists('claude');
      return {
        hasApi,
        hasCli,
        requiresClipboard: !hasApi && !hasCli
      };
    }

    case 'cursor': {
      const cliPath = config.get<string>('cursorCliPath', 'cursor-agent');
      const hasCli = await checkCommandExists(cliPath);
      return {
        hasApi: false,
        hasCli,
        requiresClipboard: !hasCli
      };
    }

    case 'vscode': {
      // VS Code Chat always requires clipboard
      return {
        hasApi: false,
        hasCli: false,
        requiresClipboard: true
      };
    }

    default:
      return {
        hasApi: false,
        hasCli: false,
        requiresClipboard: true
      };
  }
}

/**
 * Get a user-friendly message about the detected provider
 */
export function getProviderSetupMessage(result: ProviderDetectionResult): string {
  const { provider, capabilities } = result;

  if (capabilities.hasApi) {
    return `✨ ${getProviderName(provider)} API configured - automatic editing enabled`;
  }

  if (capabilities.hasCli) {
    return `🔧 ${getProviderName(provider)} CLI detected - automatic editing enabled`;
  }

  if (capabilities.requiresClipboard) {
    return `📋 ${getProviderName(provider)} using clipboard mode - install CLI for automatic editing`;
  }

  return `${getProviderName(provider)} configured`;
}

function getProviderName(provider: DetectedProvider): string {
  switch (provider) {
    case 'claude':
      return 'Claude';
    case 'cursor':
      return 'Cursor Agent';
    case 'vscode':
      return 'VS Code Chat';
    default:
      return 'AI Agent';
  }
}
