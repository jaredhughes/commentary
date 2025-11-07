/**
 * Async Mutex - Prevents race conditions in async operations
 *
 * Ensures only one async operation executes at a time by queueing
 * concurrent requests and processing them sequentially.
 *
 * Usage:
 * ```typescript
 * const mutex = new AsyncMutex();
 *
 * async function criticalSection() {
 *   await mutex.runExclusive(async () => {
 *     // Only one execution at a time
 *     const data = await read();
 *     data.modify();
 *     await write(data);
 *   });
 * }
 * ```
 */

export class AsyncMutex {
  private locked = false;
  private queue: Array<{
    operation: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }> = [];

  /**
   * Run an async operation exclusively (one at a time)
   * Concurrent calls will be queued and executed sequentially
   */
  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        operation: operation as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    // If already processing, don't start another processor
    if (this.locked) {
      return;
    }

    // Process all queued operations sequentially
    while (this.queue.length > 0) {
      this.locked = true;

      // Get next operation from queue
      const item = this.queue.shift();
      if (!item) {
        break;
      }

      try {
        // Execute the operation
        const result = await item.operation();
        item.resolve(result);
      } catch (error) {
        // Propagate error to caller
        item.reject(error);
      }
    }

    this.locked = false;
  }

  /**
   * Check if mutex is currently locked
   * Useful for debugging and testing
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get current queue length
   * Useful for monitoring and testing
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Wait for all pending operations to complete
   * Useful for cleanup and testing
   */
  async waitForUnlock(): Promise<void> {
    while (this.locked || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}

/**
 * Per-key mutex map for fine-grained locking
 * Allows concurrent operations on different keys
 *
 * Usage:
 * ```typescript
 * const mutexMap = new AsyncMutexMap();
 *
 * // These can run concurrently (different keys)
 * await mutexMap.runExclusive('file1', async () => { ... });
 * await mutexMap.runExclusive('file2', async () => { ... });
 *
 * // These run sequentially (same key)
 * await mutexMap.runExclusive('file1', async () => { ... });
 * await mutexMap.runExclusive('file1', async () => { ... });
 * ```
 */
export class AsyncMutexMap {
  private mutexes = new Map<string, AsyncMutex>();

  /**
   * Run an async operation exclusively for a specific key
   * Operations on different keys can run concurrently
   * Operations on the same key are serialized
   */
  async runExclusive<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // Get or create mutex for this key
    let mutex = this.mutexes.get(key);
    if (!mutex) {
      mutex = new AsyncMutex();
      this.mutexes.set(key, mutex);
    }

    try {
      return await mutex.runExclusive(operation);
    } finally {
      // Clean up idle mutexes to prevent memory leaks
      if (mutex.getQueueLength() === 0 && !mutex.isLocked()) {
        this.mutexes.delete(key);
      }
    }
  }

  /**
   * Get number of active mutexes
   * Useful for monitoring and testing
   */
  getActiveMutexCount(): number {
    return this.mutexes.size;
  }

  /**
   * Wait for all operations on all keys to complete
   * Useful for testing and cleanup
   */
  async waitForAllUnlock(): Promise<void> {
    const promises = Array.from(this.mutexes.values()).map(m => m.waitForUnlock());
    await Promise.all(promises);
  }

  /**
   * Clear all mutexes (for testing/cleanup)
   */
  clear(): void {
    this.mutexes.clear();
  }
}
