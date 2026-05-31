import { describe, it, expect, beforeEach } from "vitest";
import { CosineSimilarityRetrieval, TopKRetrieval, defaultRetrievalConfig, getRetrievalStrategy } from "./index";
import type { Chunk, Vector, RetrievalConfig } from "@/types";

describe("CosineSimilarityRetrieval", () => {
  let retrieval: CosineSimilarityRetrieval;
  let testChunks: Chunk[];
  let testVectors: Vector[];

  beforeEach(() => {
    retrieval = new CosineSimilarityRetrieval();
    testChunks = [
      {
        id: "chunk-1",
        documentId: "doc-1",
        content: "This is the first chunk about programming",
        startIndex: 0,
        endIndex: 45,
      },
      {
        id: "chunk-2",
        documentId: "doc-1",
        content: "This is the second chunk about cooking",
        startIndex: 46,
        endIndex: 90,
      },
      {
        id: "chunk-3",
        documentId: "doc-1",
        content: "This is the third chunk about programming",
        startIndex: 91,
        endIndex: 136,
      },
    ];

    testVectors = [
      { chunkId: "chunk-1", embedding: [1, 0, 0] },
      { chunkId: "chunk-2", embedding: [0, 1, 0] },
      { chunkId: "chunk-3", embedding: [1, 0.1, 0] },
    ];
  });

  it("should have correct name", () => {
    expect(retrieval.name).toBe("cosine-similarity");
  });

  it("should return empty array when no vectors provided", () => {
    const result = retrieval.retrieve([1, 0, 0], [], [], defaultRetrievalConfig);
    expect(result).toEqual([]);
  });

  it("should retrieve top K results", () => {
    const config: RetrievalConfig = { topK: 2 };
    const result = retrieval.retrieve([1, 0, 0], testVectors, testChunks, config);

    expect(result.length).toBeLessThanOrEqual(2);
    expect(result[0]?.similarity).toBeGreaterThanOrEqual(result[1]?.similarity || 0);
  });

  it("should filter by similarity threshold", () => {
    const config: RetrievalConfig = { topK: 3, similarityThreshold: 0.9 };
    const result = retrieval.retrieve([1, 0, 0], testVectors, testChunks, config);

    result.forEach((r) => {
      expect(r.similarity).toBeGreaterThanOrEqual(0.9);
    });
  });

  it("should return results sorted by similarity descending", () => {
    const config: RetrievalConfig = { topK: 3, similarityThreshold: 0 };
    const result = retrieval.retrieve([1, 0, 0], testVectors, testChunks, config);

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].similarity).toBeGreaterThanOrEqual(result[i].similarity);
    }
  });

  it("should handle identical vectors", () => {
    const vectors: Vector[] = [
      { chunkId: "chunk-1", embedding: [1, 1, 1] },
      { chunkId: "chunk-2", embedding: [1, 1, 1] },
    ];
    const chunks: Chunk[] = [
      { id: "chunk-1", documentId: "doc-1", content: "Test 1", startIndex: 0, endIndex: 10 },
      { id: "chunk-2", documentId: "doc-1", content: "Test 2", startIndex: 11, endIndex: 20 },
    ];
    const config: RetrievalConfig = { topK: 2 };

    const result = retrieval.retrieve([1, 1, 1], vectors, chunks, config);

    expect(result.length).toBe(2);
    expect(result[0].similarity).toBeCloseTo(1, 5);
    expect(result[1].similarity).toBeCloseTo(1, 5);
  });

  it("should handle zero vectors", () => {
    const vectors: Vector[] = [
      { chunkId: "chunk-1", embedding: [0, 0, 0] },
      { chunkId: "chunk-2", embedding: [1, 1, 1] },
    ];
    const chunks: Chunk[] = [
      { id: "chunk-1", documentId: "doc-1", content: "Zero vector", startIndex: 0, endIndex: 10 },
      { id: "chunk-2", documentId: "doc-1", content: "Non-zero vector", startIndex: 11, endIndex: 20 },
    ];
    const config: RetrievalConfig = { topK: 2 };

    const result = retrieval.retrieve([1, 0, 0], vectors, chunks, config);

    expect(result.length).toBe(2);
    expect(result[0].chunk.id).toBe("chunk-2");
    expect(result[1].chunk.id).toBe("chunk-1");
    expect(result[1].similarity).toBe(0);
  });

  it("should return chunk with result", () => {
    const config: RetrievalConfig = { topK: 1 };
    const result = retrieval.retrieve([1, 0, 0], testVectors, testChunks, config);

    expect(result[0]).toBeDefined();
    expect(result[0].chunk.id).toBe("chunk-1");
    expect(result[0].chunk.content).toBe("This is the first chunk about programming");
  });
});

describe("TopKRetrieval", () => {
  let retrieval: TopKRetrieval;
  let testChunks: Chunk[];
  let testVectors: Vector[];

  beforeEach(() => {
    retrieval = new TopKRetrieval();
    testChunks = [
      {
        id: "chunk-1",
        documentId: "doc-1",
        content: "First chunk",
        startIndex: 0,
        endIndex: 10,
      },
      {
        id: "chunk-2",
        documentId: "doc-1",
       content: "Second chunk",
        startIndex: 11,
        endIndex: 22,
      },
      {
        id: "chunk-3",
        documentId: "doc-1",
        content: "Third chunk",
        startIndex: 23,
        endIndex: 33,
      },
    ];

    testVectors = [
      { chunkId: "chunk-1", embedding: [1, 0, 0] },
      { chunkId: "chunk-2", embedding: [0, 1, 0] },
      { chunkId: "chunk-3", embedding: [0, 0, 1] },
    ];
  });

  it("should have correct name", () => {
    expect(retrieval.name).toBe("top-k");
  });

  it("should return top K results regardless of threshold", () => {
    const config: RetrievalConfig = { topK: 2 };
    const result = retrieval.retrieve([1, 0, 0], testVectors, testChunks, config);

    expect(result.length).toBe(2);
  });

  it("should not filter by similarity threshold", () => {
    const config: RetrievalConfig = { topK: 3, similarityThreshold: 0.99 };
    const result = retrieval.retrieve([1, 0, 0], testVectors, testChunks, config);

    expect(result.length).toBe(3);
  });

  it("should sort results by similarity descending", () => {
    const config: RetrievalConfig = { topK: 3 };
    const result = retrieval.retrieve([1, 0, 0], testVectors, testChunks, config);

    expect(result[0].chunk.id).toBe("chunk-1");
    expect(result[0].similarity).toBe(1);
    expect(result[1].chunk.id).toBe("chunk-2");
    expect(result[2].chunk.id).toBe("chunk-3");
  });

  it("should handle empty input", () => {
    const result = retrieval.retrieve([1, 0, 0], [], [], defaultRetrievalConfig);
    expect(result).toEqual([]);
  });

  it("should return results even with zero vectors", () => {
    const vectors: Vector[] = [
      { chunkId: "chunk-1", embedding: [0, 0, 0] },
    ];
    const chunks: Chunk[] = [
      { id: "chunk-1", documentId: "doc-1", content: "Zero chunk", startIndex: 0, endIndex: 10 },
    ];
    const config: RetrievalConfig = { topK: 1 };

    const result = retrieval.retrieve([1, 0, 0], vectors, chunks, config);

    expect(result.length).toBe(1);
    expect(result[0].similarity).toBe(0);
  });
});

describe("getRetrievalStrategy", () => {
  it("should return cosine-similarity strategy", () => {
    const strategy = getRetrievalStrategy("cosine-similarity");
    expect(strategy).toBeDefined();
    expect(strategy?.name).toBe("cosine-similarity");
  });

  it("should return top-k strategy", () => {
    const strategy = getRetrievalStrategy("top-k");
    expect(strategy).toBeDefined();
    expect(strategy?.name).toBe("top-k");
  });

  it("should return undefined for unknown strategy", () => {
    const strategy = getRetrievalStrategy("unknown-strategy");
    expect(strategy).toBeUndefined();
  });
});

describe("defaultRetrievalConfig", () => {
  it("should have correct default values", () => {
    expect(defaultRetrievalConfig.topK).toBe(3);
    expect(defaultRetrievalConfig.similarityThreshold).toBe(0.7);
  });
});

describe("Retrieval strategies comparison", () => {
  it("CosineSimilarityRetrieval should filter by threshold while TopKRetrieval does not", () => {
    const cosineRetrieval = new CosineSimilarityRetrieval();
    const topKRetrieval = new TopKRetrieval();

    const vectors: Vector[] = [
      { chunkId: "chunk-1", embedding: [1, 0, 0] },
      { chunkId: "chunk-2", embedding: [0.1, 0.1, 0.1] },
    ];
    const chunks: Chunk[] = [
      { id: "chunk-1", documentId: "doc-1", content: "High similarity", startIndex: 0, endIndex: 10 },
      { id: "chunk-2", documentId: "doc-1", content: "Low similarity", startIndex: 11, endIndex: 20 },
    ];
    const config: RetrievalConfig = { topK: 2, similarityThreshold: 0.9 };

    const cosineResults = cosineRetrieval.retrieve([1, 0, 0], vectors, chunks, config);
    const topKResults = topKRetrieval.retrieve([1, 0, 0], vectors, chunks, config);

    expect(cosineResults.length).toBe(1);
    expect(topKResults.length).toBe(2);
  });
});
