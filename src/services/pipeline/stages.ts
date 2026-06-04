import type {
  PipelineStage,
  StrategyPipelineStage,
  PipelineState,
  PipelineContext,
  UploadResult,
  HashResult,
  DeduplicateResult,
  ChunkResult,
  EmbeddingResult,
  StoreResult,
  Chunk,
  PipelineStageType,
  ChunkConfig,
  Document,
} from './types';
import { embeddingService } from '../embedding';
import { VectorStore } from '../vectorStore';
import { defaultChunkConfig, RecursiveCharacterChunking, FixedSizeChunking, type ChunkingStrategy } from '../chunking';

export class UploadStage implements PipelineStage<UploadResult, UploadResult> {
  type: PipelineStageType = 'upload';

  shouldExecute(state: PipelineState): boolean {
    return state.stages.upload.status !== 'completed';
  }

  async execute(input: UploadResult, context: PipelineContext): Promise<UploadResult> {
    context.onProgress?.(this.type, 0, '开始读取文件');
    
    if (context.abortSignal?.aborted) {
      throw new Error('上传阶段已取消');
    }

    context.onProgress?.(this.type, 50, '文件读取中');

    if (context.abortSignal?.aborted) {
      throw new Error('上传阶段已取消');
    }

    context.onProgress?.(this.type, 100, '文件读取完成');
    
    return {
      content: input.content,
      fileName: input.fileName,
      size: input.size,
      type: input.type,
    };
  }

  async rollback(): Promise<void> {
  }

  getDescription(): string {
    return '文件上传';
  }
}

export class HashStage implements PipelineStage<UploadResult, HashResult> {
  type: PipelineStageType = 'hash';

  shouldExecute(state: PipelineState): boolean {
    return state.stages.hash.status !== 'completed';
  }

  async execute(input: UploadResult, context: PipelineContext): Promise<HashResult> {
    context.onProgress?.(this.type, 0, '计算文件哈希');
    
    if (context.abortSignal?.aborted) {
      throw new Error('哈希计算阶段已取消');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(input.content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    context.onProgress?.(this.type, 100, '哈希计算完成');

    return {
      hash,
      algorithm: 'SHA-256',
    };
  }

  async rollback(): Promise<void> {
  }

  getDescription(): string {
    return '哈希计算';
  }
}

export class DeduplicateStage implements PipelineStage<HashResult, DeduplicateResult> {
  type: PipelineStageType = 'deduplicate';
  private vectorStore: VectorStore;

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
  }

  shouldExecute(state: PipelineState): boolean {
    return state.stages.deduplicate.status !== 'completed';
  }

  async execute(input: HashResult, context: PipelineContext): Promise<DeduplicateResult> {
    context.onProgress?.(this.type, 0, '检查重复文件');
    
    if (context.abortSignal?.aborted) {
      throw new Error('去重阶段已取消');
    }

    const isDuplicate = this.vectorStore.hasDocumentHash(input.hash);

    context.onProgress?.(this.type, 100, isDuplicate ? '发现重复文件' : '文件未重复');

    return {
      isDuplicate,
      existingDocumentId: isDuplicate ? undefined : undefined,
    };
  }

  async rollback(): Promise<void> {
  }

  getDescription(): string {
    return '重复检测';
  }
}

export class ChunkStage implements StrategyPipelineStage<UploadResult, ChunkResult> {
  type: PipelineStageType = 'chunk';
  private strategy: ChunkingStrategy;
  private strategyName: string;
  private chunkConfig: ChunkConfig;

  constructor(chunkConfig: ChunkConfig = defaultChunkConfig, strategyName: string = 'recursive-character') {
    this.chunkConfig = chunkConfig;
    this.strategyName = strategyName;
    this.strategy = this.getStrategyByName(strategyName);
  }

  private getStrategyByName(name: string): ChunkingStrategy {
    if (name === 'fixed-size') {
      return new FixedSizeChunking();
    }
    if (name === 'recursive-character') {
      return new RecursiveCharacterChunking();
    }
    // 对于未识别的策略，创建一个包装类，保持名称不变但行为默认
    class WrapperStrategy implements ChunkingStrategy {
      name = name;
      private base = new RecursiveCharacterChunking();
      chunk(document: Document, config: ChunkConfig) {
        return this.base.chunk(document, config);
      }
    }
    return new WrapperStrategy();
  }

  setStrategy(strategyName: string): void {
    this.strategyName = strategyName;
    this.strategy = this.getStrategyByName(strategyName);
  }

  getCurrentStrategy(): string {
    return this.strategyName;
  }

  setChunkConfig(config: ChunkConfig): void {
    this.chunkConfig = config;
  }

  getChunkConfig(): ChunkConfig {
    return this.chunkConfig;
  }

  shouldExecute(state: PipelineState): boolean {
    const stageState = state.stages.chunk;
    return stageState.status !== 'completed' || stageState.strategy !== this.strategy.name;
  }

  async execute(input: UploadResult, context: PipelineContext): Promise<ChunkResult> {
    context.onProgress?.(this.type, 0, `开始分块 (策略: ${this.strategy.name}, 大小: ${this.chunkConfig.chunkSize})`);
    
    if (context.abortSignal?.aborted) {
      throw new Error('分块阶段已取消');
    }

    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const document: Document = {
      id: documentId,
      name: input.fileName,
      content: input.content,
      type: input.type,
      size: input.size,
      uploadedAt: new Date(),
    };
    
    const chunks = this.strategy.chunk(document, this.chunkConfig);
    
    chunks.forEach((chunk, index) => {
      chunk.id = `chunk-${documentId}-${index}`;
    });

    context.onProgress?.(this.type, 100, `分块完成，共 ${chunks.length} 个`);

    return {
      documentId,
      chunks,
    };
  }

  async rollback(): Promise<void> {
  }

  getDescription(): string {
    return `文本分块 (${this.strategy.name})`;
  }
}

export class EmbedStage implements PipelineStage<ChunkResult, EmbeddingResult> {
  type: PipelineStageType = 'embed';

  shouldExecute(state: PipelineState): boolean {
    return state.stages.embed.status !== 'completed';
  }

  async execute(input: ChunkResult, context: PipelineContext): Promise<EmbeddingResult> {
    context.onProgress?.(this.type, 0, '初始化嵌入模型');
    
    if (context.abortSignal?.aborted) {
      throw new Error('嵌入阶段已取消');
    }

    await embeddingService.init();
    
    if (context.abortSignal?.aborted) {
      throw new Error('嵌入阶段已取消');
    }

    context.onProgress?.(this.type, 10, '开始生成嵌入向量');

    const embeddings: number[][] = [];
    const totalChunks = input.chunks.length;

    for (let i = 0; i < totalChunks; i++) {
      if (context.abortSignal?.aborted) {
        throw new Error('嵌入阶段已取消');
      }

      const chunk = input.chunks[i];
      const embedding = await embeddingService.embedSingle(chunk.content);
      
      embeddings.push(embedding);

      const progress = 10 + (i / totalChunks) * 90;
      context.onProgress?.(this.type, Math.round(progress), `已嵌入 ${i + 1}/${totalChunks}`);
    }

    context.onProgress?.(this.type, 100, '嵌入完成');

    return {
      chunks: input.chunks,
      embeddings,
    };
  }

  async rollback(): Promise<void> {
  }

  getDescription(): string {
    return '向量嵌入';
  }
}

export class StoreStage implements PipelineStage<EmbeddingResult, StoreResult> {
  type: PipelineStageType = 'store';
  private vectorStore: VectorStore;

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
  }

  shouldExecute(state: PipelineState): boolean {
    return state.stages.store.status !== 'completed';
  }

  async execute(input: EmbeddingResult, context: PipelineContext): Promise<StoreResult> {
    context.onProgress?.(this.type, 0, '准备存储向量');
    
    if (context.abortSignal?.aborted) {
      throw new Error('存储阶段已取消');
    }

    const prevSize = this.vectorStore.size();
    
    const documentId = input.chunks[0]?.documentId || '';

    await this.vectorStore.addChunks(input.chunks);
    
    context.onProgress?.(this.type, 50, '存储中...');

    if (context.abortSignal?.aborted) {
      throw new Error('存储阶段已取消');
    }

    const newSize = this.vectorStore.size();
    const hash = context.state.stages.hash.output as HashResult | undefined;
    if (hash) {
      this.saveDocumentHash(hash.hash, documentId);
    }

    context.onProgress?.(this.type, 100, '存储完成');

    return {
      success: true,
      chunkCount: input.chunks.length,
      vectorCount: newSize - prevSize,
    };
  }

  private saveDocumentHash(hash: string, documentId: string): void {
    this.vectorStore.addDocumentHash(hash, documentId);
  }

  async rollback(): Promise<void> {
    const storeOutput = this.getLastStoreOutput();
    if (storeOutput && storeOutput.documentId) {
      this.vectorStore.deleteDocument(storeOutput.documentId);
    }
  }

  private getLastStoreOutput(): { documentId: string } | undefined {
    return undefined;
  }

  getDescription(): string {
    return '向量存储';
  }
}

export const createDefaultStages = (vectorStore: VectorStore, chunkConfig?: ChunkConfig, strategyName?: string): PipelineStage[] => [
  new UploadStage(),
  new HashStage(),
  new DeduplicateStage(vectorStore),
  new ChunkStage(chunkConfig || defaultChunkConfig, strategyName),
  new EmbedStage(),
  new StoreStage(vectorStore),
];
