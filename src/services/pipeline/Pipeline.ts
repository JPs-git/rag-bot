import type {
  PipelineStage,
  PipelineState,
  PipelineContext,
  PipelineStageType,
  StageState,
  PipelineStateStore,
  UploadResult,
  HashResult,
  ChunkResult,
  EmbeddingResult,
} from './types';
import { localStorageStateStore } from './stateStore';

export class Pipeline {
  private stages: PipelineStage[];
  private stateStore: PipelineStateStore;
  private abortController?: AbortController;

  constructor(stages: PipelineStage[], stateStore: PipelineStateStore = localStorageStateStore) {
    this.stages = stages;
    this.stateStore = stateStore;
  }

  private generateId(): string {
    return `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private createEmptyStageState(type: PipelineStageType): StageState {
    return {
      type,
      status: 'pending',
    };
  }

  private createInitialState(file: File): PipelineState {
    const stages: Record<PipelineStageType, StageState> = {
      upload: this.createEmptyStageState('upload'),
      hash: this.createEmptyStageState('hash'),
      deduplicate: this.createEmptyStageState('deduplicate'),
      chunk: this.createEmptyStageState('chunk'),
      embed: this.createEmptyStageState('embed'),
      store: this.createEmptyStageState('store'),
    };

    return {
      id: this.generateId(),
      fileId: `file-${Date.now()}`,
      fileName: file.name,
      fileSize: file.size,
      stages,
      currentStage: 'upload',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private needsRedo(state: PipelineState, stage: PipelineStage): boolean {
    const stageState = state.stages[stage.type];
    if (stageState.status !== 'completed') return false;

    if ('getCurrentStrategy' in stage) {
      const strategyStage = stage as unknown as { getCurrentStrategy: () => string };
      return stageState.strategy !== strategyStage.getCurrentStrategy();
    }

    return false;
  }

  private async getStageInput(state: PipelineState, stage: PipelineStage): Promise<unknown> {
    switch (stage.type) {
      case 'upload':
        return state.uploadResult || null;
      case 'hash':
        return state.stages.upload.output as UploadResult;
      case 'deduplicate':
        return state.stages.hash.output as HashResult;
      case 'chunk':
        return state.stages.upload.output as UploadResult;
      case 'embed':
        return state.stages.chunk.output as ChunkResult;
      case 'store':
        return state.stages.embed.output as EmbeddingResult;
      default:
        throw new Error(`Unknown stage type: ${stage.type}`);
    }
  }

  async start(file: File, onProgress?: (stage: PipelineStageType, progress: number, message?: string) => void): Promise<PipelineState> {
    const fileContent = await file.text();
    const uploadResult: UploadResult = {
      content: fileContent,
      fileName: file.name,
      size: file.size,
      type: file.name.endsWith('.md') ? 'md' : 'txt',
    };
    
    const initialState = this.createInitialState(file);
    initialState.uploadResult = uploadResult;
    await this.stateStore.save(initialState);
    
    return this.continue(initialState.id, onProgress);
  }

  async continue(pipelineId: string, onProgress?: (stage: PipelineStageType, progress: number, message?: string) => void): Promise<PipelineState> {
    const state = await this.stateStore.load(pipelineId);
    if (!state) {
      throw new Error('Pipeline state not found');
    }

    this.abortController = new AbortController();

    for (const stage of this.stages) {
      const stageState = state.stages[stage.type];

      if (stageState.status === 'completed') {
        if (!this.needsRedo(state, stage)) {
          continue;
        }
        await stage.rollback(state);
      }

      state.currentStage = stage.type;
      stageState.status = 'in_progress';
      state.updatedAt = Date.now();
      await this.stateStore.save(state);

      try {
        const input = await this.getStageInput(state, stage);
        if (input === null && stage.type === 'upload') {
          throw new Error('Upload file data not found');
        }

        const context: PipelineContext = {
          state,
          abortSignal: this.abortController.signal,
          onProgress,
        };

        const output = await stage.execute(input, context);

        stageState.status = 'completed';
        stageState.output = output;
        stageState.timestamp = Date.now();
        
        if ('getCurrentStrategy' in stage) {
          const strategyStage = stage as unknown as { getCurrentStrategy: () => string };
          stageState.strategy = strategyStage.getCurrentStrategy();
        }

        state.updatedAt = Date.now();
        await this.stateStore.save(state);

        if (stage.type === 'deduplicate') {
          const deduplicateOutput = output as { isDuplicate?: boolean };
          if (deduplicateOutput?.isDuplicate) {
            onProgress?.(stage.type, 100, '文件已存在，跳过后续步骤');
            return state;
          }
        }

      } catch (error) {
        stageState.status = 'failed';
        stageState.error = error instanceof Error ? error.message : String(error);
        state.updatedAt = Date.now();
        await this.stateStore.save(state);
        throw error;
      }
    }

    return state;
  }

  abort(): void {
    this.abortController?.abort();
  }

  async redo(pipelineId: string, targetStage: PipelineStageType, onProgress?: (stage: PipelineStageType, progress: number, message?: string) => void): Promise<PipelineState> {
    const state = await this.stateStore.load(pipelineId);
    if (!state) {
      throw new Error('Pipeline state not found');
    }

    const stageIndex = this.stages.findIndex((s) => s.type === targetStage);
    if (stageIndex === -1) {
      throw new Error(`Stage ${targetStage} not found`);
    }

    for (let i = stageIndex; i < this.stages.length; i++) {
      const stage = this.stages[i];
      const stageType = stage.type;
      await stage.rollback(state);
      state.stages[stageType] = this.createEmptyStageState(stageType);
    }

    state.updatedAt = Date.now();
    await this.stateStore.save(state);

    return this.continue(pipelineId, onProgress);
  }

  async switchStrategy(pipelineId: string, stageType: PipelineStageType, strategyName: string): Promise<PipelineState> {
    const state = await this.stateStore.load(pipelineId);
    if (!state) {
      throw new Error('Pipeline state not found');
    }

    const stage = this.stages.find((s) => s.type === stageType);
    if (!stage || !('setStrategy' in stage)) {
      throw new Error(`Stage ${stageType} does not support strategy switching`);
    }

    const strategyStage = stage as unknown as { setStrategy: (name: string) => void };
    strategyStage.setStrategy(strategyName);
    state.stages[stageType].strategy = strategyName;
    state.updatedAt = Date.now();
    await this.stateStore.save(state);

    return this.redo(pipelineId, stageType);
  }

  async getState(pipelineId: string): Promise<PipelineState | null> {
    return this.stateStore.load(pipelineId);
  }

  async deleteState(pipelineId: string): Promise<void> {
    await this.stateStore.delete(pipelineId);
  }

  async listStates(): Promise<PipelineState[]> {
    return this.stateStore.list();
  }

  setStages(stages: PipelineStage[]): void {
    this.stages = stages;
  }

  getStages(): PipelineStage[] {
    return [...this.stages];
  }
}
