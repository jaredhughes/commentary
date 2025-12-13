import * as vscode from 'vscode';

export class ExpansionStateManager {
	private expansionState: Set<string> = new Set();

	constructor(private context: vscode.ExtensionContext) {
		void this.loadState();
	}

	private normalize(folderPath: string): string {
		// Normalize to POSIX-style paths for cross-platform consistency
		return folderPath.replace(/\\/g, '/');
	}

	isExpanded(folderPath: string): boolean {
		return this.expansionState.has(this.normalize(folderPath));
	}

	setExpanded(folderPath: string, expanded: boolean): void {
		const key = this.normalize(folderPath);
		if (expanded) {
			this.expansionState.add(key);
		} else {
			this.expansionState.delete(key);
		}
		void this.saveState();
	}

	private async loadState(): Promise<void> {
		try {
			// Load from workspace state
			const saved = this.context.workspaceState.get<string[]>('commentary.expansionState', []);
			this.expansionState = new Set(saved);
			console.log('[Commentary] Loaded expansion state:', saved.length, 'folders');
		} catch (error) {
			console.error('[Commentary] Failed to load expansion state:', error);
			this.expansionState = new Set();
		}
	}

	private async saveState(): Promise<void> {
		try {
			// Save to workspace state
			const stateArray = Array.from(this.expansionState);
			await this.context.workspaceState.update('commentary.expansionState', stateArray);
		} catch (error) {
			console.error('[Commentary] Failed to save expansion state:', error);
		}
	}

	clear(): void {
		this.expansionState.clear();
		void this.saveState();
	}
}
