/**
 * Tests for DocumentNavigationService
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { DocumentNavigationService, DEFAULT_TIMING_CONFIG } from './documentNavigation';
import { MarkdownWebviewProvider } from '../preview/markdownWebview';
import { OverlayHost } from '../preview/overlayHost';

/**
 * Mock webview provider for testing
 */
class MockWebviewProvider {
  async openMarkdown(_document: vscode.TextDocument): Promise<void> {
    // Mock implementation - does nothing
  }
}

/**
 * Failing webview provider for error testing
 */
class FailingWebviewProvider extends MockWebviewProvider {
  async openMarkdown(_document: vscode.TextDocument): Promise<void> {
    throw new Error('Invalid URI');
  }
}

/**
 * Mock overlay host for testing
 */
class MockOverlayHost {
  public webviewPanels: Map<string, vscode.WebviewPanel> = new Map();
}

suite('DocumentNavigationService Test Suite', () => {
  let service: DocumentNavigationService;

  // Mock timing config for faster tests
  const testTimingConfig = {
    newDocumentDelay: 50,
    existingDocumentDelay: 20,
  };

  test('DEFAULT_TIMING_CONFIG should have reasonable values', () => {
    assert.ok(DEFAULT_TIMING_CONFIG.newDocumentDelay > 0, 'New document delay should be positive');
    assert.ok(DEFAULT_TIMING_CONFIG.existingDocumentDelay > 0, 'Existing document delay should be positive');
    assert.ok(
      DEFAULT_TIMING_CONFIG.newDocumentDelay >= DEFAULT_TIMING_CONFIG.existingDocumentDelay,
      'New document delay should be >= existing document delay'
    );
  });

  test('waitForDocumentReady should use correct delay', async function() {
    this.timeout(5000);

    // Create mock service
    const mockWebviewProvider = new MockWebviewProvider() as unknown as MarkdownWebviewProvider;
    const mockOverlayHost = new MockOverlayHost() as unknown as OverlayHost;
    
    service = new DocumentNavigationService(mockWebviewProvider, mockOverlayHost, testTimingConfig);

    // Test new document delay
    const newDocStart = Date.now();
    await service.waitForDocumentReady('file:///test.md', false);
    const newDocDuration = Date.now() - newDocStart;
    assert.ok(
      newDocDuration >= testTimingConfig.newDocumentDelay - 10,
      `New document delay should be ~${testTimingConfig.newDocumentDelay}ms, got ${newDocDuration}ms`
    );

    // Test existing document delay
    const existingDocStart = Date.now();
    await service.waitForDocumentReady('file:///test.md', true);
    const existingDocDuration = Date.now() - existingDocStart;
    assert.ok(
      existingDocDuration >= testTimingConfig.existingDocumentDelay - 10,
      `Existing document delay should be ~${testTimingConfig.existingDocumentDelay}ms, got ${existingDocDuration}ms`
    );
  });

  test('Timing configuration should be customizable', () => {
    const customConfig = {
      newDocumentDelay: 100,
      existingDocumentDelay: 50,
    };

    const mockWebviewProvider = new MockWebviewProvider() as unknown as MarkdownWebviewProvider;
    const mockOverlayHost = new MockOverlayHost() as unknown as OverlayHost;
    
    const customService = new DocumentNavigationService(
      mockWebviewProvider,
      mockOverlayHost,
      customConfig
    );

    // We can't directly test the private config, but we can verify it was accepted
    assert.ok(customService, 'Service should be created with custom config');
  });

  test('Service should handle invalid URIs gracefully', async function() {
    this.timeout(5000);

    const mockWebviewProvider = new FailingWebviewProvider() as unknown as MarkdownWebviewProvider;
    const mockOverlayHost = new MockOverlayHost() as unknown as OverlayHost;
    
    service = new DocumentNavigationService(mockWebviewProvider, mockOverlayHost, testTimingConfig);

    // This should not throw, just return undefined
    const result = await service.ensureDocumentOpen('invalid://uri');
    assert.strictEqual(result, undefined, 'Should return undefined for invalid URI');
  });
});
