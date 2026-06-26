type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(private defaultTtlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);

    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  deletePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}