/**
 * Mock ProviderAdapter for testing AgentClient without real provider execution
 */

import { AgentRequest } from '../../types';
import { SendResult } from '../../agent/providers/types';

export class MockProviderAdapter {
  public sendCalls: Array<{ prompt: string; request: AgentRequest }> = [];
  public mockResult: SendResult = {
    success: true,
    method: 'clipboard',
    message: 'Mock success'
  };

  async send(prompt: string, request: AgentRequest): Promise<SendResult> {
    this.sendCalls.push({ prompt, request });
    return Promise.resolve(this.mockResult);
  }

  dispose(): void {
    // Mock dispose
  }
}
