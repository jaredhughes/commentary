import * as vscode from 'vscode';
import * as path from 'path';

export enum GitStatus {
	Unmodified = 'unmodified',
	Modified = 'modified',
	Staged = 'staged',
	Both = 'both', // Both staged and unstaged
	Untracked = 'untracked',
}

export interface FileGitStatus {
	uri: vscode.Uri;
	status: GitStatus;
}

interface GitExtension {
	getAPI(version: number): GitAPI;
}

interface GitAPI {
	repositories: Repository[];
	onDidOpenRepository: vscode.Event<Repository>;
	onDidCloseRepository: vscode.Event<Repository>;
}

interface Repository {
	rootUri: vscode.Uri;
	state: RepositoryState;
}

interface RepositoryState {
	workingTreeChanges: Change[];
	indexChanges: Change[];
	onDidChange: vscode.Event<void>;
}

interface Change {
	uri: vscode.Uri;
	status: number;
}

/**
 * Git status constants from VS Code Git extension
 * @see https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts
 */
const GIT_STATUS_UNTRACKED = 7;

export class GitStatusProvider {
	private _onDidChangeStatus = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
	readonly onDidChangeStatus = this._onDidChangeStatus.event;

	private statusCache = new Map<string, GitStatus>();
	private gitExtension: GitExtension | undefined;
	private gitAPI: GitAPI | undefined;
	private disposables: vscode.Disposable[] = [];

	constructor() {
		void this.initializeGitExtension();
	}

	private async initializeGitExtension(): Promise<void> {
		try {
			const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
			if (!extension) {
				console.log('[Commentary] Git extension not found');
				return;
			}

			if (!extension.isActive) {
				await extension.activate();
			}

			this.gitExtension = extension.exports;
			this.gitAPI = this.gitExtension.getAPI(1);

			// Watch for Git status changes in all repositories
			for (const repo of this.gitAPI.repositories) {
				this.watchRepository(repo);
			}

			// Watch for new repositories
			this.disposables.push(
				this.gitAPI.onDidOpenRepository((repo) => {
					this.watchRepository(repo);
					this.clearCache();
					this._onDidChangeStatus.fire([]);
				})
			);

			this.disposables.push(
				this.gitAPI.onDidCloseRepository(() => {
					this.clearCache();
					this._onDidChangeStatus.fire([]);
				})
			);

		} catch (error) {
			console.error('[Commentary] Failed to initialize Git extension:', error);
		}
	}

	private watchRepository(repo: Repository): void {
		this.disposables.push(
			repo.state.onDidChange(() => {
				// Clear cache and notify of changes
				this.clearCache();
				this._onDidChangeStatus.fire([]);
			})
		);
	}

	async getStatus(uri: vscode.Uri): Promise<GitStatus> {
		const uriString = uri.toString();

		// Check cache first
		if (this.statusCache.has(uriString)) {
			return this.statusCache.get(uriString)!;
		}

		// Compute status
		const status = await this.computeStatus(uri);
		this.statusCache.set(uriString, status);
		return status;
	}

	private async computeStatus(uri: vscode.Uri): Promise<GitStatus> {
		if (!this.gitAPI) {
			return GitStatus.Unmodified;
		}

		try {
			// Find the repository that contains this file
			const repo = this.gitAPI.repositories.find((r) => {
				const repoPath = r.rootUri.fsPath;
				const filePath = uri.fsPath;
				// Ensure path separator follows repoPath to avoid false matches
				// (e.g., /project-backup should not match /project)
				return filePath === repoPath || filePath.startsWith(repoPath + path.sep);
			});

			if (!repo) {
				return GitStatus.Unmodified;
			}

			const uriString = uri.toString();

			// Check if file is in working tree changes (unstaged)
			const workingTreeChange = repo.state.workingTreeChanges.find(
				(change) => change.uri.toString() === uriString
			);

			// Check if file is in index changes (staged)
			const indexChange = repo.state.indexChanges.find(
				(change) => change.uri.toString() === uriString
			);

			// Determine untracked status
			const isUntracked = workingTreeChange?.status === GIT_STATUS_UNTRACKED;

			if (workingTreeChange && indexChange) {
				return GitStatus.Both;
			} else if (indexChange) {
				return GitStatus.Staged;
			} else if (workingTreeChange) {
				return isUntracked ? GitStatus.Untracked : GitStatus.Modified;
			}

			return GitStatus.Unmodified;
		} catch (error) {
			console.error('[Commentary] Error computing Git status:', error);
			return GitStatus.Unmodified;
		}
	}

	async refresh(uri?: vscode.Uri): Promise<void> {
		if (uri) {
			this.statusCache.delete(uri.toString());
			this._onDidChangeStatus.fire(uri);
		} else {
			this.clearCache();
			this._onDidChangeStatus.fire([]);
		}
	}

	private clearCache(): void {
		this.statusCache.clear();
	}

	dispose(): void {
		this._onDidChangeStatus.dispose();
		this.disposables.forEach((d) => d.dispose());
		this.disposables = [];
	}
}
