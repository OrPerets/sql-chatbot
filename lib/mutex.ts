// Simple in-memory keyed mutex to serialize operations per key (e.g., per homework set)
// Note: This only guarantees serialization within a single server instance.

type Release = () => void;

class KeyedMutex {
  private locks: Map<string, Promise<void>> = new Map();

  async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) || Promise.resolve();

    let release: Release;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Chain: wait for previous to finish before running `task`
    this.locks.set(
      key,
      previous.finally(() => current)
    );

    try {
      // Wait for previous lock
      await previous;
      // Execute task exclusively
      const result = await task();
      return result;
    } finally {
      // Release this lock and clean up if no one is queued
      (release as any)();
      // If the stored promise equals the current chain, delete to prevent map growth
      const stored = this.locks.get(key);
      if (stored === current) {
        this.locks.delete(key);
      }
    }
  }
}

export const globalKeyedMutex = new KeyedMutex();


