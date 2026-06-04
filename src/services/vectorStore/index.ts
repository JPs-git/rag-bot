import type { Vector, Chunk, RetrievedChunk } from "@/types";
import type { RetrievalStrategy } from "@/types";
import { CosineSimilarityRetrieval } from "../retrieval";
import { embeddingService } from "../embedding";
import { PERFORMANCE_CONFIG, delay } from "@/config/performance";

export class VectorStore {
  private vectors: Vector[] = [];
  private chunks: Chunk[] = [];
  private retrievalStrategy: RetrievalStrategy;
  private documentHashes: Set<string> = new Set();
  private documentIdToHash: Map<string, string> = new Map();

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
    this.documentHashes.clear();
  }

  addDocumentHash(hash: string, documentId: string): void {
    this.documentHashes.add(hash);
    this.documentIdToHash.set(documentId, hash);
  }

  hasDocumentHash(hash: string): boolean {
    return this.documentHashes.has(hash);
  }

  removeDocumentHash(hash: string): void {
    this.documentHashes.delete(hash);
    for (const [docId, docHash] of this.documentIdToHash.entries()) {
      if (docHash === hash) {
        this.documentIdToHash.delete(docId);
        break;
      }
    }
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

  deleteDocument(documentId: string): void {
    const chunkIds = this.chunks
      .filter((chunk) => chunk.documentId === documentId)
      .map((chunk) => chunk.id);

    this.chunks = this.chunks.filter((chunk) => chunk.documentId !== documentId);
    this.vectors = this.vectors.filter((vector) => !chunkIds.includes(vector.chunkId));

    const hash = this.documentIdToHash.get(documentId);
    if (hash) {
      this.documentHashes.delete(hash);
      this.documentIdToHash.delete(documentId);
    }

    console.log(`[VS] Deleted ${chunkIds.length} chunks for document ${documentId}`);
  }
}

export const vectorStore = new VectorStore();
