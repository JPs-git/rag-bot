export type PipelineStageType =
  | 'upload'
  | 'hash'
  | 'deduplicate'
  | 'chunk'
  | 'embed'
  | 'store';

export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface StageState<T = unknown> {
  type: PipelineStageType;
  status: StageStatus;
  input?: unknown;
  output?: T;
  error?: string;
  timestamp?: number;
  strategy?: string;
}

export interface PipelineState {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  stages: Record<PipelineStageType, StageState>;
  currentStage: PipelineStageType;
  createdAt: number;
  updatedAt: number;
  uploadResult?: UploadResult;
}

export interface PipelineContext {
  state: PipelineState;
  abortSignal?: AbortSignal;
  onProgress?: (stage: PipelineStageType, progress: number, message?: string) => void;
  onStageComplete?: (stage: PipelineStageType, output: unknown) => void;
  onStageError?: (stage: PipelineStageType, error: Error) => void;
}

export interface UploadResult {
  content: string;
  fileName: string;
  size: number;
  type: 'txt' | 'md';
}

export interface HashResult {
  hash: string;
  algorithm: string;
}

export interface DeduplicateResult {
  isDuplicate: boolean;
  existingDocumentId?: string;
}

export interface ChunkResult {
  documentId: string;
  chunks: Chunk[];
}

export interface EmbeddingResult {
  chunks: Chunk[];
  embeddings: number[][];
}

export interface StoreResult {
  success: boolean;
  chunkCount: number;
  vectorCount: number;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

export interface PipelineStage<I = unknown, O = unknown> {
  type: PipelineStageType;
  shouldExecute(state: PipelineState): boolean;
  execute(input: I, context: PipelineContext): Promise<O>;
  rollback(state: PipelineState): Promise<void>;
  getDescription(): string;
}

export interface StrategyPipelineStage<I = unknown, O = unknown> extends PipelineStage<I, O> {
  setStrategy(strategyName: string): void;
  getCurrentStrategy(): string;
}

export interface PipelineStateStore {
  save(state: PipelineState): Promise<void>;
  load(pipelineId: string): Promise<PipelineState | null>;
  delete(pipelineId: string): Promise<void>;
  list(): Promise<PipelineState[]>;
}
