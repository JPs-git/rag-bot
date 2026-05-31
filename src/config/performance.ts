export const PERFORMANCE_CONFIG = {
  MAX_FILE_SIZE: 1 * 1024 * 1024,  // 1MB
  MAX_FILE_COUNT: 5,
  MAX_TOTAL_CONTENT_SIZE: 3 * 1024 * 1024,  // 3MB
  MAX_CHUNKS: 300,
  MAX_CHUNK_SIZE: 300,
  CHUNK_OVERLAP: 30,
  EMBEDDING_BATCH_SIZE: 3,
  BATCH_DELAY_MS: 150,
  MAX_TEXT_LENGTH_PER_EMBED: 500,
  MAX_VECTORS: 300,
  WARN_MEMORY_THRESHOLD: 0.8,
  CRITICAL_MEMORY_THRESHOLD: 0.9,
} as const;

export const MEMORY_CHECK = {
  getUsedMemoryMB(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const perf = performance as { memory?: { usedJSHeapSize: number } };
      if (perf.memory) {
        return perf.memory.usedJSHeapSize / (1024 * 1024);
      }
    }
    return 0;
  },

  getTotalMemoryMB(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const perf = performance as { memory?: { totalJSHeapSize: number } };
      if (perf.memory) {
        return perf.memory.totalJSHeapSize / (1024 * 1024);
      }
    }
    return 0;
  },

  isMemoryPressure(): boolean {
    const used = this.getUsedMemoryMB();
    const total = this.getTotalMemoryMB();
    if (total === 0) return false;
    return used / total > PERFORMANCE_CONFIG.WARN_MEMORY_THRESHOLD;
  },

  isMemoryCritical(): boolean {
    const used = this.getUsedMemoryMB();
    const total = this.getTotalMemoryMB();
    if (total === 0) return false;
    return used / total > PERFORMANCE_CONFIG.CRITICAL_MEMORY_THRESHOLD;
  },

  logMemoryStatus(prefix: string): void {
    const used = this.getUsedMemoryMB();
    const total = this.getTotalMemoryMB();
    if (total === 0) {
      console.log(`${prefix} Memory: API not available`);
    } else {
      console.log(`${prefix} Memory: ${used.toFixed(1)}MB / ${total.toFixed(1)}MB (${((used / total) * 100).toFixed(1)}%)`);
    }
  },
};

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function forceGC(): void {
  // 尝试触发垃圾回收
  // 在浏览器环境
  if (typeof window !== 'undefined' && 'gc' in window) {
    try {
      (window as { gc?: () => void }).gc?.();
    } catch {
      // 忽略
    }
  }
  // 在 Node.js 环境
  if (typeof global !== 'undefined' && 'gc' in global) {
    try {
      (global as { gc?: () => void }).gc?.();
    } catch {
      // 忽略
    }
  }
}
