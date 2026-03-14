/**
 * StockfishPool — manages multiple Stockfish Web Workers for parallel evaluation,
 * with a FEN-keyed cache and a priority task queue.
 */

import { StockfishService, type MultiPVResult } from './stockfishService';

export interface CachedEval {
  lines: MultiPVResult[];
  depth: number;
  multiPV: number;
}

interface QueuedTask {
  fen: string;
  depth: number;
  multiPV: number;
  priority: number; // lower = higher priority
  resolve: (result: MultiPVResult[]) => void;
  reject: (err: Error) => void;
}

const POOL_SIZE = 3;

class StockfishPool {
  private workers: StockfishService[] = [];
  private available: StockfishService[] = [];
  private queue: QueuedTask[] = [];
  private cache = new Map<string, CachedEval>();
  private initPromise: Promise<void> | null = null;

  /** Initialize the worker pool */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const promises: Promise<void>[] = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        const worker = new StockfishService();
        this.workers.push(worker);
        promises.push(
          worker.init().then(() => {
            this.available.push(worker);
          })
        );
      }
      await Promise.all(promises);
    })();

    return this.initPromise;
  }

  /** Build a cache key from FEN + analysis params */
  private cacheKey(fen: string, multiPV: number): string {
    return `${fen}|mpv${multiPV}`;
  }

  /** Check if we have a cached result at sufficient depth */
  getCached(fen: string, depth: number, multiPV: number): CachedEval | null {
    const key = this.cacheKey(fen, multiPV);
    const cached = this.cache.get(key);
    if (cached && cached.depth >= depth) return cached;
    return null;
  }

  /**
   * Evaluate a position. Returns cached result if available at sufficient depth,
   * otherwise queues the evaluation.
   * @param priority - Lower number = higher priority. Current position = 0, prefetch = 10.
   */
  async evaluate(fen: string, depth: number, multiPV: number, priority = 5): Promise<MultiPVResult[]> {
    await this.init();

    // Check cache
    const cached = this.getCached(fen, depth, multiPV);
    if (cached) return cached.lines;

    return new Promise<MultiPVResult[]>((resolve, reject) => {
      const task: QueuedTask = { fen, depth, multiPV, priority, resolve, reject };

      // Insert into queue sorted by priority
      let inserted = false;
      for (let i = 0; i < this.queue.length; i++) {
        if (task.priority < this.queue[i].priority) {
          this.queue.splice(i, 0, task);
          inserted = true;
          break;
        }
      }
      if (!inserted) this.queue.push(task);

      this.dispatch();
    });
  }

  /** Try to dispatch queued tasks to available workers */
  private dispatch(): void {
    while (this.available.length > 0 && this.queue.length > 0) {
      const worker = this.available.shift()!;
      const task = this.queue.shift()!;
      this.runTask(worker, task);
    }
  }

  /** Run a single evaluation task on a worker */
  private async runTask(worker: StockfishService, task: QueuedTask): Promise<void> {
    try {
      const results = await worker.evaluateMultiPV(task.fen, task.depth, task.multiPV);

      // Cache the result
      const key = this.cacheKey(task.fen, task.multiPV);
      const existing = this.cache.get(key);
      if (!existing || task.depth >= existing.depth) {
        this.cache.set(key, { lines: results, depth: task.depth, multiPV: task.multiPV });
      }

      task.resolve(results);
    } catch (err) {
      task.reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.available.push(worker);
      this.dispatch();
    }
  }

  /** Clear all pending tasks (e.g. when loading a new game) */
  clearQueue(): void {
    for (const task of this.queue) {
      task.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }

  /** Clear the cache */
  clearCache(): void {
    this.cache.clear();
  }

  destroy(): void {
    this.clearQueue();
    for (const w of this.workers) {
      w.destroy();
    }
    this.workers = [];
    this.available = [];
    this.cache.clear();
    this.initPromise = null;
  }
}

// Singleton
let pool: StockfishPool | null = null;

export function getStockfishPool(): StockfishPool {
  if (!pool) {
    pool = new StockfishPool();
  }
  return pool;
}
