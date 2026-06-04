import type { PipelineState, PipelineStateStore } from './types';

const STORAGE_KEY_PREFIX = 'rag-bot:pipeline:';

export class LocalStorageStateStore implements PipelineStateStore {
  async save(state: PipelineState): Promise<void> {
    const key = STORAGE_KEY_PREFIX + state.id;
    localStorage.setItem(key, JSON.stringify(state));
  }

  async load(pipelineId: string): Promise<PipelineState | null> {
    const key = STORAGE_KEY_PREFIX + pipelineId;
    const data = localStorage.getItem(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async delete(pipelineId: string): Promise<void> {
    const key = STORAGE_KEY_PREFIX + pipelineId;
    localStorage.removeItem(key);
  }

  async list(): Promise<PipelineState[]> {
    const states: PipelineState[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            states.push(JSON.parse(data));
          }
        } catch {
          continue;
        }
      }
    }
    return states.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

export const localStorageStateStore = new LocalStorageStateStore();
