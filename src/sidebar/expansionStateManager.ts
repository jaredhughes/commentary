import * as vscode from 'vscode';

export class ExpansionStateManager {
	private expansionState: Set<string> = new Set();

	constructor(private context: vscode.ExtensionContext) {
		this.loadState();
	}

	isExpanded(folderPath: string): boolean {
		return this.expansionState.has(folderPath);
	}

	setExpanded(folderPath: string, expanded: boolean): void {
		if (expanded) {
			this.expansionState.add(folderPath);
		} else {
			this.expansionState.delete(folderPath);
		}
		this.saveState();
	}

	private loadState(): void {
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

	private saveState(): void {
		try {
			// Save to workspace state
			const stateArray = Array.from(this.expansionState);
			this.context.workspaceState.update('commentary.expansionState', stateArray);
		} catch (error) {
			console.error('[Commentary] Failed to save expansion state:', error);
		}
	}

	clear(): void {
		this.expansionState.clear();
		this.saveState();
	}
}
