import { describe, expect, it, vi } from "vitest";

import { TTLCache } from "./simpleCache";

describe("TTLCache", () => {
  it("returns live values and removes expired values", () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string>(1_000);

    cache.set("key", "value");
    expect(cache.get("key")).toBe("value");

    vi.advanceTimersByTime(1_001);
    expect(cache.get("key")).toBeUndefined();
    vi.useRealTimers();
  });

  it("deletes only entries matching a prefix", () => {
    const cache = new TTLCache<number>(1_000);
    cache.set("users:first", 1);
    cache.set("users:second", 2);
    cache.set("events:first", 3);

    cache.deletePrefix("users:");

    expect(cache.get("users:first")).toBeUndefined();
    expect(cache.get("users:second")).toBeUndefined();
    expect(cache.get("events:first")).toBe(3);
  });
});
