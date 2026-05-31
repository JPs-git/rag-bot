import type { Vector, Chunk, RetrievedChunk } from "@/types";
import type { RetrievalStrategy } from "@/types";
import { CosineSimilarityRetrieval } from "../retrieval";
import { embeddingService } from "../embedding";
import { PERFORMANCE_CONFIG, delay } from "@/config/performance";

export class VectorStore {
  private vectors: Vector[] = [];
  private chunks: Chunk[] = [];
  private retrievalStrategy: RetrievalStrategy;

  constructor(strategy: RetrievalStrategy = new CosineSimilarityRetrieval()) {
    this.retrievalStrategy = strategy;
  }

  async addChunks(chunks: Chunk[], batchSize?: number): Promise<void> {
    const effectiveBatchSize =
      batchSize || PERFORMANCE_CONFIG.EMBEDDING_BATCH_SIZE;

    const availableSlots = PERFORMANCE_CONFIG.MAX_VECTORS - this.vectors.length;
    const chunksToAdd = chunks.slice(0, availableSlots);

    if (chunksToAdd.length < chunks.length) {
      console.warn(
        `[VS] Limiting chunks from ${chunks.length} to ${chunksToAdd.length} (max vectors: ${PERFORMANCE_CONFIG.MAX_VECTORS})`,
      );
    }

    const startTime = performance.now();
    let processedChunks = 0;

    for (let i = 0; i < chunksToAdd.length; i += effectiveBatchSize) {
      let batch = chunksToAdd.slice(
        i,
        Math.min(i + effectiveBatchSize, chunksToAdd.length),
      );

      let contents = batch.map((c) => c.content);
      let embeddings = await embeddingService.embed(contents);

      let newVectors: Vector[] = batch.map((chunk, index) => ({
        chunkId: chunk.id,
        embedding: embeddings[index],
      }));

      this.chunks.push(...batch);
      this.vectors.push(...newVectors);
      processedChunks += batch.length;

      batch = [];
      contents = [];
      embeddings = [];
      newVectors = [];

      if (i + effectiveBatchSize < chunksToAdd.length) {
        await delay(PERFORMANCE_CONFIG.BATCH_DELAY_MS);
      }
    }

    const elapsed = (performance.now() - startTime).toFixed(0);
    console.log(`[VS] Added ${processedChunks} chunks in ${elapsed}ms`);
  }

  async retrieve(
    query: string,
    topK: number,
    similarityThreshold?: number,
  ): Promise<RetrievedChunk[]> {
    if (this.vectors.length === 0) {
      return [];
    }

    const queryVector = await embeddingService.embedSingle(query);

    const results = this.retrievalStrategy.retrieve(
      queryVector,
      this.vectors,
      this.chunks,
      {
        topK,
        similarityThreshold,
      },
    );

    console.log(`[VS] Retrieved ${results.length} chunks for query`);

    return results;
  }

  getChunks(): Chunk[] {
    return [...this.chunks];
  }

  getVectors(): Vector[] {
    return [...this.vectors];
  }

  clear(): void {
    this.vectors = [];
    this.chunks = [];
  }

  size(): number {
    return this.vectors.length;
  }

  isFull(): boolean {
    return this.vectors.length >= PERFORMANCE_CONFIG.MAX_VECTORS;
  }

  setRetrievalStrategy(strategy: RetrievalStrategy): void {
    this.retrievalStrategy = strategy;
  }
}

export const vectorStore = new VectorStore();
