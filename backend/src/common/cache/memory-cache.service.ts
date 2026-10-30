import { Injectable, Logger } from '@nestjs/common';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRatio: number;
  entryCount: number;
  maxCapacity: number;
}

@Injectable()
export class MemoryCacheService {
  private readonly logger = new Logger(MemoryCacheService.name);
  private readonly store = new Map<string, CacheEntry<any>>();
  private readonly inFlight = new Map<string, Promise<any>>();
  private readonly maxCapacity: number = 500;

  private hits = 0;
  private misses = 0;

  constructor() {
    // Periodic light sweep to clean up dead keys every 5 minutes
    const sweepInterval = setInterval(() => {
      this.evictExpired();
    }, 5 * 60 * 1000);

    // Ensure the interval doesn't keep the Node.js process alive if exiting
    if (sweepInterval.unref) {
      sweepInterval.unref();
    }
  }

  /**
   * Retrieves a value from the cache if present and unexpired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    entry.lastAccessed = Date.now();
    return entry.value as T;
  }

  /**
   * Stores a value in the cache with the given TTL in seconds.
   */
  set<T>(key: string, value: T, ttlSeconds: number = 300): void {
    try {
      if (this.store.size >= this.maxCapacity && !this.store.has(key)) {
        this.evictOne();
      }

      this.store.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
        lastAccessed: Date.now(),
      });
    } catch (err) {
      this.logger.warn(`Failed to store cache key "${key}": ${(err as Error).message}`);
    }
  }

  /**
   * Single-flight cache loader.
   * Prevents cache stampedes: concurrent calls for the same key share a single DB loader promise.
   * Fails safe: if caching operations fail, loader() is called directly.
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = this.get<T>(key);
      if (cached !== undefined) {
        this.hits++;
        return cached;
      }

      this.misses++;

      // Check if another concurrent request is already loading this exact key
      let pendingPromise = this.inFlight.get(key) as Promise<T> | undefined;
      if (!pendingPromise) {
        pendingPromise = (async () => {
          try {
            const data = await loader();
            this.set(key, data, ttlSeconds);
            return data;
          } finally {
            this.inFlight.delete(key);
          }
        })();

        this.inFlight.set(key, pendingPromise);
      }

      return await pendingPromise;
    } catch (err) {
      // In case of any unexpected cache layer anomaly, ensure business logic is not interrupted
      this.logger.warn(`Cache getOrSet anomaly on key "${key}", invoking loader directly`);
      return loader();
    }
  }

  /**
   * Invalidates a single specific key.
   */
  invalidate(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Invalidates all keys matching a given prefix.
   * e.g. invalidatePattern('academic:') invalidates all academic cache entries.
   */
  invalidatePattern(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }

  /**
   * Returns telemetry and performance statistics.
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio: totalRequests > 0 ? Number((this.hits / totalRequests).toFixed(4)) : 0,
      entryCount: this.store.size,
      maxCapacity: this.maxCapacity,
    };
  }

  /**
   * Resets hit/miss telemetry counters.
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Evicts expired items.
   */
  private evictExpired(): number {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        evicted++;
      }
    }
    return evicted;
  }

  /**
   * Evicts one entry using LRU (least recently accessed) or expired.
   */
  private evictOne(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        return;
      }
    }

    // Evict lowest lastAccessed
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }
}

