/**
 * StockfishService — manages a Stockfish Web Worker and provides
 * a promise-based API for UCI commands.
 */

export interface EngineEval {
  /** Centipawns from white's perspective. null if mate. */
  cp: number | null;
  /** Mate in N moves (positive = white mates, negative = black mates). null if no mate. */
  mate: number | null;
  /** Best move in UCI notation (e.g. "e2e4") */
  bestMove: string;
  /** Best move in SAN will be filled in by caller */
  bestMoveSan?: string;
  /** Principal variation */
  pv: string[];
  /** Search depth reached */
  depth: number;
}

export interface MultiPVResult {
  rank: number;
  cp: number | null;
  mate: number | null;
  pv: string[];
  depth: number;
}

type ReadyCallback = () => void;

export class StockfishService {
  private worker: Worker | null = null;
  private readyResolve: ReadyCallback | null = null;
  private isReady = false;

  async init(): Promise<void> {
    if (this.worker) return;

    return new Promise((resolve, reject) => {
      try {
        // Load from public directory (Vite serves these as static files)
        const base = import.meta.env.BASE_URL || '/';
        this.worker = new Worker(`${base}stockfish/stockfish.js`);

        this.worker.onerror = (e) => {
          reject(new Error(`Stockfish worker failed to load: ${e.message}`));
        };

        this.worker.onmessage = (e) => {
          const line = typeof e.data === 'string' ? e.data : '';
          if (line === 'uciok') {
            this.isReady = true;
            resolve();
          }
        };

        this.worker.postMessage('uci');
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Evaluate a position and return the engine's assessment.
   * @param fen - The FEN string to evaluate
   * @param depth - Search depth (default 16)
   */
  async evaluate(fen: string, depth = 16): Promise<EngineEval> {
    if (!this.worker || !this.isReady) {
      throw new Error('Stockfish not initialized. Call init() first.');
    }

    return new Promise((resolve) => {
      let lastInfo: Partial<EngineEval> = { cp: 0, mate: null, pv: [], depth: 0 };

      const handler = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : '';

        // Parse "info" lines for score and PV
        if (line.startsWith('info') && line.includes('score') && line.includes(' pv ')) {
          const depthMatch = line.match(/\bdepth (\d+)/);
          const cpMatch = line.match(/\bscore cp (-?\d+)/);
          const mateMatch = line.match(/\bscore mate (-?\d+)/);
          const pvMatch = line.match(/ pv (.+)/);

          if (depthMatch) lastInfo.depth = parseInt(depthMatch[1]);
          if (cpMatch) {
            lastInfo.cp = parseInt(cpMatch[1]);
            lastInfo.mate = null;
          }
          if (mateMatch) {
            lastInfo.mate = parseInt(mateMatch[1]);
            lastInfo.cp = null;
          }
          if (pvMatch) lastInfo.pv = pvMatch[1].trim().split(/\s+/);
        }

        // "bestmove" signals the search is complete
        if (line.startsWith('bestmove')) {
          this.worker!.removeEventListener('message', handler);
          const bestMove = line.split(/\s+/)[1] || '';
          resolve({
            cp: lastInfo.cp ?? 0,
            mate: lastInfo.mate ?? null,
            bestMove,
            pv: lastInfo.pv || [],
            depth: lastInfo.depth || depth,
          });
        }
      };

      this.worker!.addEventListener('message', handler);

      // Wait for "isready" confirmation before searching
      const readyHandler = (e: MessageEvent) => {
        if (typeof e.data === 'string' && e.data === 'readyok') {
          this.worker!.removeEventListener('message', readyHandler);
          this.worker!.postMessage(`go depth ${depth}`);
        }
      };
      this.worker!.addEventListener('message', readyHandler);

      this.worker!.postMessage('stop');
      this.worker!.postMessage(`position fen ${fen}`);
      this.worker!.postMessage('isready');
    });
  }

  /**
   * Evaluate a position with multiple principal variations (MultiPV).
   * Returns an array of lines sorted by rank.
   */
  async evaluateMultiPV(fen: string, depth = 16, numLines = 3): Promise<MultiPVResult[]> {
    if (!this.worker || !this.isReady) {
      throw new Error('Stockfish not initialized. Call init() first.');
    }

    return new Promise((resolve) => {
      // Track the best info per multipv line at the deepest depth seen
      const lines = new Map<number, MultiPVResult>();

      const handler = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : '';

        if (line.startsWith('info') && line.includes('score') && line.includes(' pv ')) {
          const depthMatch = line.match(/\bdepth (\d+)/);
          const multipvMatch = line.match(/\bmultipv (\d+)/);
          const cpMatch = line.match(/\bscore cp (-?\d+)/);
          const mateMatch = line.match(/\bscore mate (-?\d+)/);
          const pvMatch = line.match(/ pv (.+)/);

          const rank = multipvMatch ? parseInt(multipvMatch[1]) : 1;
          const d = depthMatch ? parseInt(depthMatch[1]) : 0;
          const pv = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];

          const entry: MultiPVResult = {
            rank,
            cp: cpMatch ? parseInt(cpMatch[1]) : (mateMatch ? null : 0),
            mate: mateMatch ? parseInt(mateMatch[1]) : null,
            pv,
            depth: d,
          };

          // Only keep the deepest result per rank
          const existing = lines.get(rank);
          if (!existing || d >= existing.depth) {
            lines.set(rank, entry);
          }
        }

        if (line.startsWith('bestmove')) {
          this.worker!.removeEventListener('message', handler);
          const result = Array.from(lines.values()).sort((a, b) => a.rank - b.rank);
          resolve(result);
        }
      };

      this.worker!.addEventListener('message', handler);

      const readyHandler = (e: MessageEvent) => {
        if (typeof e.data === 'string' && e.data === 'readyok') {
          this.worker!.removeEventListener('message', readyHandler);
          this.worker!.postMessage(`go depth ${depth}`);
        }
      };
      this.worker!.addEventListener('message', readyHandler);

      this.worker!.postMessage('stop');
      this.worker!.postMessage(`setoption name MultiPV value ${numLines}`);
      this.worker!.postMessage(`position fen ${fen}`);
      this.worker!.postMessage('isready');
    });
  }

  /** Send "isready" and wait for "readyok" */
  async waitReady(): Promise<void> {
    if (!this.worker) return;
    return new Promise((resolve) => {
      this.readyResolve = resolve;
      const handler = (e: MessageEvent) => {
        if (typeof e.data === 'string' && e.data === 'readyok') {
          this.worker!.removeEventListener('message', handler);
          if (this.readyResolve) {
            this.readyResolve();
            this.readyResolve = null;
          }
        }
      };
      this.worker!.addEventListener('message', handler);
      this.worker!.postMessage('isready');
    });
  }

  destroy(): void {
    if (this.worker) {
      this.worker.postMessage('quit');
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}

// Singleton instance
let instance: StockfishService | null = null;

export function getStockfishService(): StockfishService {
  if (!instance) {
    instance = new StockfishService();
  }
  return instance;
}
