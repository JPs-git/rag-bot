import type { Vector, Chunk, RetrievalConfig, RetrievedChunk, RetrievalStrategy } from '@/types';

export const defaultRetrievalConfig: RetrievalConfig = {
  topK: 3,
  similarityThreshold: 0.7,
};

export class CosineSimilarityRetrieval implements RetrievalStrategy {
  name = 'cosine-similarity';

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, idx) => sum + val * b[idx], 0);
  }

  private magnitude(a: number[]): number {
    return Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dot = this.dotProduct(a, b);
    const magA = this.magnitude(a);
    const magB = this.magnitude(b);
    if (magA === 0 || magB === 0) return 0;
    return dot / (magA * magB);
  }

  retrieve(
    queryVector: number[],
    vectors: Vector[],
    chunks: Chunk[],
    config: RetrievalConfig
  ): RetrievedChunk[] {
    const results: RetrievedChunk[] = [];

    for (const vector of vectors) {
      const similarity = this.cosineSimilarity(queryVector, vector.embedding);
      
      if (config.similarityThreshold && similarity < config.similarityThreshold) {
        continue;
      }

      const chunk = chunks.find((c) => c.id === vector.chunkId);
      if (chunk) {
        results.push({ chunk, similarity });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, config.topK);
  }
}

export class TopKRetrieval implements RetrievalStrategy {
  name = 'top-k';

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, idx) => sum + val * b[idx], 0);
  }

  private magnitude(a: number[]): number {
    return Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dot = this.dotProduct(a, b);
    const magA = this.magnitude(a);
    const magB = this.magnitude(b);
    if (magA === 0 || magB === 0) return 0;
    return dot / (magA * magB);
  }

  retrieve(
    queryVector: number[],
    vectors: Vector[],
    chunks: Chunk[],
    config: RetrievalConfig
  ): RetrievedChunk[] {
    const results: RetrievedChunk[] = [];

    for (const vector of vectors) {
      const similarity = this.cosineSimilarity(queryVector, vector.embedding);
      const chunk = chunks.find((c) => c.id === vector.chunkId);
      
      if (chunk) {
        results.push({ chunk, similarity });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, config.topK);
  }
}

export const retrievalStrategies: RetrievalStrategy[] = [
  new CosineSimilarityRetrieval(),
  new TopKRetrieval(),
];

export function getRetrievalStrategy(name: string): RetrievalStrategy | undefined {
  return retrievalStrategies.find((s) => s.name === name);
}
