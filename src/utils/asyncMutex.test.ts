/**
 * Tests for AsyncMutex - Race condition prevention
 */

import * as assert from 'assert';
import { AsyncMutex, AsyncMutexMap } from './asyncMutex';

suite('AsyncMutex Test Suite', () => {
  suite('Basic Functionality', () => {
    test('should execute single operation', async () => {
      const mutex = new AsyncMutex();
      let executed = false;

      await mutex.runExclusive(async () => {
        executed = true;
      });

      assert.strictEqual(executed, true);
    });

    test('should return operation result', async () => {
      const mutex = new AsyncMutex();

      const result = await mutex.runExclusive(async () => {
        return 42;
      });

      assert.strictEqual(result, 42);
    });

    test('should propagate errors', async () => {
      const mutex = new AsyncMutex();

      await assert.rejects(
        mutex.runExclusive(async () => {
          throw new Error('Test error');
        }),
        /Test error/
      );
    });
  });

  suite('Sequential Execution', () => {
    test('should serialize concurrent operations', async () => {
      const mutex = new AsyncMutex();
      const executionOrder: number[] = [];

      // Start multiple operations concurrently
      const promises = [
        mutex.runExclusive(async () => {
          executionOrder.push(1);
          await new Promise(resolve => setTimeout(resolve, 50));
          executionOrder.push(2);
        }),
        mutex.runExclusive(async () => {
          executionOrder.push(3);
          await new Promise(resolve => setTimeout(resolve, 50));
          executionOrder.push(4);
        }),
        mutex.runExclusive(async () => {
          executionOrder.push(5);
          await new Promise(resolve => setTimeout(resolve, 50));
          executionOrder.push(6);
        })
      ];

      await Promise.all(promises);

      // Should execute in order: [1,2,3,4,5,6]
      // NOT interleaved like: [1,3,5,2,4,6]
      assert.deepStrictEqual(executionOrder, [1, 2, 3, 4, 5, 6]);
    });

    test('should prevent read-modify-write race condition', async () => {
      const mutex = new AsyncMutex();
      let counter = 0;

      // Simulate 100 concurrent increments
      const promises = Array.from({ length: 100 }, () =>
        mutex.runExclusive(async () => {
          // Read
          const current = counter;
          // Simulate async delay
          await new Promise(resolve => setTimeout(resolve, 1));
          // Modify and write
          counter = current + 1;
        })
      );

      await Promise.all(promises);

      // Without mutex, this would be less than 100 due to race conditions
      assert.strictEqual(counter, 100);
    });
  });

  suite('Error Handling', () => {
    test('should continue processing after error', async () => {
      const mutex = new AsyncMutex();
      const results: string[] = [];

      const promises = [
        mutex.runExclusive(async () => {
          results.push('op1');
        }),
        mutex.runExclusive(async () => {
          results.push('op2-before-error');
          throw new Error('Intentional error');
        }).catch(() => {
          results.push('op2-caught');
        }),
        mutex.runExclusive(async () => {
          results.push('op3');
        })
      ];

      await Promise.all(promises);

      // The catch handler runs after promise rejection, so op3 completes first
      assert.deepStrictEqual(results, ['op1', 'op2-before-error', 'op3', 'op2-caught']);
    });

    test('should not block queue on error', async () => {
      const mutex = new AsyncMutex();
      let successCount = 0;

      const promises = [
        mutex.runExclusive(async () => {
          throw new Error('First error');
        }).catch(() => { /* ignore */ }),
        mutex.runExclusive(async () => {
          successCount++;
        }),
        mutex.runExclusive(async () => {
          throw new Error('Second error');
        }).catch(() => { /* ignore */ }),
        mutex.runExclusive(async () => {
          successCount++;
        })
      ];

      await Promise.all(promises);

      assert.strictEqual(successCount, 2);
    });
  });

  suite('State Inspection', () => {
    test('isLocked should reflect mutex state', async () => {
      const mutex = new AsyncMutex();

      assert.strictEqual(mutex.isLocked(), false);

      const promise = mutex.runExclusive(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Should be locked during execution
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.strictEqual(mutex.isLocked(), true);

      await promise;

      // Should be unlocked after completion
      assert.strictEqual(mutex.isLocked(), false);
    });

    test('getQueueLength should reflect queue size', async () => {
      const mutex = new AsyncMutex();

      assert.strictEqual(mutex.getQueueLength(), 0);

      // Start a long operation
      const longOp = mutex.runExclusive(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Queue more operations
      const op1 = mutex.runExclusive(async () => { /* noop */ });
      const op2 = mutex.runExclusive(async () => { /* noop */ });
      const op3 = mutex.runExclusive(async () => { /* noop */ });

      // Give time for queue to build
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should have 3 queued (first is executing)
      assert.strictEqual(mutex.getQueueLength(), 3);

      await Promise.all([longOp, op1, op2, op3]);

      assert.strictEqual(mutex.getQueueLength(), 0);
    });

    test('waitForUnlock should wait for completion', async () => {
      const mutex = new AsyncMutex();
      let completed = false;

      // Start operation
      mutex.runExclusive(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        completed = true;
      });

      // Wait for unlock
      await mutex.waitForUnlock();

      assert.strictEqual(completed, true);
    });
  });
});

suite('AsyncMutexMap Test Suite', () => {
  suite('Per-Key Locking', () => {
    test('should allow concurrent operations on different keys', async () => {
      const mutexMap = new AsyncMutexMap();
      const executionLog: string[] = [];

      const promises = [
        mutexMap.runExclusive('key1', async () => {
          executionLog.push('key1-start');
          await new Promise(resolve => setTimeout(resolve, 50));
          executionLog.push('key1-end');
        }),
        mutexMap.runExclusive('key2', async () => {
          executionLog.push('key2-start');
          await new Promise(resolve => setTimeout(resolve, 50));
          executionLog.push('key2-end');
        }),
        mutexMap.runExclusive('key3', async () => {
          executionLog.push('key3-start');
          await new Promise(resolve => setTimeout(resolve, 50));
          executionLog.push('key3-end');
        })
      ];

      await Promise.all(promises);

      // All should start before any end (concurrent execution)
      const startIndex1 = executionLog.indexOf('key1-start');
      const startIndex2 = executionLog.indexOf('key2-start');
      const startIndex3 = executionLog.indexOf('key3-start');
      const endIndex1 = executionLog.indexOf('key1-end');
      const endIndex2 = executionLog.indexOf('key2-end');
      const endIndex3 = executionLog.indexOf('key3-end');

      assert.ok(startIndex1 < endIndex1);
      assert.ok(startIndex2 < endIndex2);
      assert.ok(startIndex3 < endIndex3);

      // All starts should happen before all ends (concurrent)
      const allStarts = [startIndex1, startIndex2, startIndex3];
      const allEnds = [endIndex1, endIndex2, endIndex3];
      const maxStart = Math.max(...allStarts);
      const minEnd = Math.min(...allEnds);

      assert.ok(maxStart < minEnd, 'Operations should overlap (run concurrently)');
    });

    test('should serialize operations on same key', async () => {
      const mutexMap = new AsyncMutexMap();
      const executionLog: string[] = [];

      const promises = [
        mutexMap.runExclusive('file1', async () => {
          executionLog.push('op1-start');
          await new Promise(resolve => setTimeout(resolve, 50));
          executionLog.push('op1-end');
        }),
        mutexMap.runExclusive('file1', async () => {
          executionLog.push('op2-start');
          await new Promise(resolve => setTimeout(resolve, 50));
          executionLog.push('op2-end');
        }),
        mutexMap.runExclusive('file1', async () => {
          executionLog.push('op3-start');
          await new Promise(resolve => setTimeout(resolve, 50));
          executionLog.push('op3-end');
        })
      ];

      await Promise.all(promises);

      // Should execute sequentially
      assert.deepStrictEqual(executionLog, [
        'op1-start', 'op1-end',
        'op2-start', 'op2-end',
        'op3-start', 'op3-end'
      ]);
    });

    test('should prevent race condition in storage simulation', async () => {
      const mutexMap = new AsyncMutexMap();
      const storage = new Map<string, number[]>();

      // Simulate 50 concurrent saves to same file
      const fileUri = 'file:///test.md';
      const promises = Array.from({ length: 50 }, (_, i) =>
        mutexMap.runExclusive(fileUri, async () => {
          // Read
          const notes = storage.get(fileUri) || [];
          // Simulate async delay
          await new Promise(resolve => setTimeout(resolve, 1));
          // Modify
          notes.push(i);
          // Write
          storage.set(fileUri, notes);
        })
      );

      await Promise.all(promises);

      const notes = storage.get(fileUri) || [];
      // Without mutex, length would be less than 50
      assert.strictEqual(notes.length, 50);
      // Should have all numbers 0-49
      assert.deepStrictEqual(notes.sort((a, b) => a - b), Array.from({ length: 50 }, (_, i) => i));
    });
  });

  suite('Memory Management', () => {
    test('should clean up idle mutexes', async () => {
      const mutexMap = new AsyncMutexMap();

      // Create operations for different keys
      await mutexMap.runExclusive('key1', async () => { /* noop */ });
      await mutexMap.runExclusive('key2', async () => { /* noop */ });
      await mutexMap.runExclusive('key3', async () => { /* noop */ });

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 50));

      // All mutexes should be cleaned up
      assert.strictEqual(mutexMap.getActiveMutexCount(), 0);
    });

    test('should not clean up active mutexes', async () => {
      const mutexMap = new AsyncMutexMap();

      // Start long operation
      const longOp = mutexMap.runExclusive('key1', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Try to trigger cleanup
      await new Promise(resolve => setTimeout(resolve, 10));

      // Mutex should still exist (operation in progress)
      assert.strictEqual(mutexMap.getActiveMutexCount(), 1);

      await longOp;
    });
  });

  suite('Utility Methods', () => {
    test('waitForAllUnlock should wait for all keys', async () => {
      const mutexMap = new AsyncMutexMap();
      let allCompleted = false;

      // Start operations on multiple keys
      mutexMap.runExclusive('key1', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      mutexMap.runExclusive('key2', async () => {
        await new Promise(resolve => setTimeout(resolve, 75));
      });
      mutexMap.runExclusive('key3', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        allCompleted = true;
      });

      // Wait for all
      await mutexMap.waitForAllUnlock();

      assert.strictEqual(allCompleted, true);
    });

    test('clear should remove all mutexes', () => {
      const mutexMap = new AsyncMutexMap();

      // Create some mutexes (start operations)
      mutexMap.runExclusive('key1', async () => { await new Promise(resolve => setTimeout(resolve, 1000)); });
      mutexMap.runExclusive('key2', async () => { await new Promise(resolve => setTimeout(resolve, 1000)); });

      mutexMap.clear();

      assert.strictEqual(mutexMap.getActiveMutexCount(), 0);
    });
  });
});
