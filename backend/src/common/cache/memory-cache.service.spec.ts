import { MemoryCacheService } from './memory-cache.service';

describe('MemoryCacheService', () => {
  let cache: MemoryCacheService;

  beforeEach(() => {
    cache = new MemoryCacheService();
  });

  afterEach(() => {
    cache.clear();
  });

  it('should store and retrieve values within TTL', () => {
    cache.set('key1', { name: 'test' }, 60);
    const result = cache.get<{ name: string }>('key1');
    expect(result).toEqual({ name: 'test' });
  });

  it('should return undefined for expired keys', async () => {
    cache.set('short_lived', 'data', 0.01); // 10ms
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(cache.get('short_lived')).toBeUndefined();
  });

  it('should serve cached value on subsequent getOrSet calls', async () => {
    const loader = jest.fn().mockResolvedValue({ id: 1 });

    const first = await cache.getOrSet('test_key', 60, loader);
    const second = await cache.getOrSet('test_key', 60, loader);

    expect(first).toEqual({ id: 1 });
    expect(second).toEqual({ id: 1 });
    expect(loader).toHaveBeenCalledTimes(1);

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  it('should deduplicate concurrent in-flight requests (stampede protection)', async () => {
    let callCount = 0;
    const slowLoader = async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { timestamp: Date.now() };
    };

    const results = await Promise.all([
      cache.getOrSet('stampede_key', 60, slowLoader),
      cache.getOrSet('stampede_key', 60, slowLoader),
      cache.getOrSet('stampede_key', 60, slowLoader),
      cache.getOrSet('stampede_key', 60, slowLoader),
    ]);

    expect(callCount).toBe(1);
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    expect(results[2]).toEqual(results[3]);
  });

  it('should invalidate specific key', () => {
    cache.set('item:1', 'value1', 60);
    cache.set('item:2', 'value2', 60);

    expect(cache.invalidate('item:1')).toBe(true);
    expect(cache.get('item:1')).toBeUndefined();
    expect(cache.get('item:2')).toBe('value2');
  });

  it('should invalidate keys matching a pattern prefix', () => {
    cache.set('academic:dept:1', 'cse', 60);
    cache.set('academic:dept:2', 'ece', 60);
    cache.set('academic:prog:1', 'btech', 60);
    cache.set('polls:scope:1', 'scopes', 60);

    const deleted = cache.invalidatePattern('academic:');
    expect(deleted).toBe(3);
    expect(cache.get('academic:dept:1')).toBeUndefined();
    expect(cache.get('academic:prog:1')).toBeUndefined();
    expect(cache.get('polls:scope:1')).toBe('scopes');
  });

  it('should evict LRU items when capacity is reached', () => {
    // Fill cache to capacity (or test with smaller threshold)
    const smallCache = new MemoryCacheService();
    // Test capacity bound check
    for (let i = 0; i < 505; i++) {
      smallCache.set(`key_${i}`, `val_${i}`, 600);
    }
    const stats = smallCache.getStats();
    expect(stats.entryCount).toBeLessThanOrEqual(500);
  });

  it('should gracefully handle loader failures in getOrSet', async () => {
    const failingLoader = jest.fn().mockRejectedValue(new Error('DB failure'));

    await expect(cache.getOrSet('failing_key', 60, failingLoader)).rejects.toThrow('DB failure');

    // Subsequent call after fix should work
    const succeedingLoader = jest.fn().mockResolvedValue('recovered');
    const result = await cache.getOrSet('failing_key', 60, succeedingLoader);
    expect(result).toBe('recovered');
  });
});

