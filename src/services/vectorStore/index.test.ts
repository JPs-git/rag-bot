import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { VectorStore } from "./index";
import { CosineSimilarityRetrieval, TopKRetrieval } from "../retrieval";
import type { Chunk } from "@/types";

vi.mock("../embedding", () => ({
  embeddingService: {
    embed: vi.fn().mockImplementation((texts: string[]) => {
      return Promise.resolve(
        texts.map(() => [0.5, 0.5, 0.5, 0.5, 0.5])
      );
    }),
    embedSingle: vi.fn().mockImplementation((text: string) => {
      return Promise.resolve([0.5, 0.5, 0.5, 0.5, 0.5]);
    }),
    isInitialized: vi.fn().mockReturnValue(true),
  },
}));

describe("VectorStore", () => {
  let vectorStore: VectorStore;
  let testChunks: Chunk[];

  beforeEach(() => {
    vectorStore = new VectorStore();
    testChunks = [
      {
        id: "chunk-1",
        documentId: "doc-1",
        content: "First test chunk about JavaScript programming",
        startIndex: 0,
        endIndex: 45,
      },
      {
        id: "chunk-2",
        documentId: "doc-1",
        content: "Second test chunk about TypeScript development",
        startIndex: 46,
        endIndex: 90,
      },
      {
        id: "chunk-3",
        documentId: "doc-1",
        content: "Third test chunk about React and web development",
        startIndex: 91,
        endIndex: 136,
      },
    ];
  });

  afterEach(() => {
    vectorStore.clear();
    vi.clearAllMocks();
  });

  describe("Constructor", () => {
    it("should create instance with default strategy", () => {
      const vs = new VectorStore();
      expect(vs).toBeInstanceOf(VectorStore);
    });

    it("should create instance with custom strategy", () => {
      const customStrategy = new TopKRetrieval();
      const vs = new VectorStore(customStrategy);
      expect(vs).toBeInstanceOf(VectorStore);
    });
  });

  describe("addChunks", () => {
    it("should add chunks successfully", async () => {
      await vectorStore.addChunks(testChunks);

      expect(vectorStore.size()).toBe(testChunks.length);
      expect(vectorStore.getChunks().length).toBe(testChunks.length);
    });

    it("should store chunks and vectors separately", async () => {
      await vectorStore.addChunks(testChunks);

      const chunks = vectorStore.getChunks();
      const vectors = vectorStore.getVectors();

      expect(chunks.length).toBe(testChunks.length);
      expect(vectors.length).toBe(testChunks.length);
    });

    it("should maintain chunk order", async () => {
      await vectorStore.addChunks(testChunks);

      const chunks = vectorStore.getChunks();
      chunks.forEach((chunk, index) => {
        expect(chunk.id).toBe(testChunks[index].id);
      });
    });

    it("should add vectors with correct chunkId", async () => {
      await vectorStore.addChunks(testChunks);

      const vectors = vectorStore.getVectors();
      vectors.forEach((vector, index) => {
        expect(vector.chunkId).toBe(testChunks[index].id);
        expect(vector.embedding).toHaveLength(5);
      });
    });

    it("should handle empty chunks array", async () => {
      await vectorStore.addChunks([]);
      expect(vectorStore.size()).toBe(0);
    });
  });

  describe("retrieve", () => {
    beforeEach(async () => {
      await vectorStore.addChunks(testChunks);
    });

    it("should retrieve chunks based on query", async () => {
      const results = await vectorStore.retrieve("programming", 2);

      expect(results.length).toBeLessThanOrEqual(2);
      results.forEach((result) => {
        expect(result.chunk).toBeDefined();
        expect(typeof result.similarity).toBe("number");
      });
    });

    it("should return empty array when store is empty", async () => {
      const emptyStore = new VectorStore();
      const results = await emptyStore.retrieve("test query", 3);

      expect(results).toEqual([]);
    });

    it("should respect topK parameter", async () => {
      const results = await vectorStore.retrieve("test", 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("should respect similarityThreshold parameter", async () => {
      const results = await vectorStore.retrieve("test", 3, 0.99);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("getChunks", () => {
    it("should return copy of chunks array", async () => {
      await vectorStore.addChunks(testChunks);

      const chunks1 = vectorStore.getChunks();
      const chunks2 = vectorStore.getChunks();

      expect(chunks1).not.toBe(chunks2);
      expect(chunks1).toEqual(chunks2);
    });

    it("should return empty array when no chunks added", () => {
      const chunks = vectorStore.getChunks();
      expect(chunks).toEqual([]);
    });
  });

  describe("getVectors", () => {
    it("should return copy of vectors array", async () => {
      await vectorStore.addChunks(testChunks);

      const vectors1 = vectorStore.getVectors();
      const vectors2 = vectorStore.getVectors();

      expect(vectors1).not.toBe(vectors2);
      expect(vectors1).toEqual(vectors2);
    });

    it("should return empty array when no vectors added", () => {
      const vectors = vectorStore.getVectors();
      expect(vectors).toEqual([]);
    });
  });

  describe("clear", () => {
    it("should clear all chunks and vectors", async () => {
      await vectorStore.addChunks(testChunks);
      expect(vectorStore.size()).toBe(testChunks.length);

      vectorStore.clear();

      expect(vectorStore.size()).toBe(0);
      expect(vectorStore.getChunks()).toEqual([]);
      expect(vectorStore.getVectors()).toEqual([]);
    });

    it("should allow adding new chunks after clear", async () => {
      await vectorStore.addChunks(testChunks);
      vectorStore.clear();

      const newChunks = testChunks.slice(0, 1);
      await vectorStore.addChunks(newChunks);

      expect(vectorStore.size()).toBe(1);
    });
  });

  describe("size", () => {
    it("should return correct size", async () => {
      expect(vectorStore.size()).toBe(0);

      await vectorStore.addChunks(testChunks);
      expect(vectorStore.size()).toBe(testChunks.length);

      await vectorStore.addChunks(testChunks);
      expect(vectorStore.size()).toBe(testChunks.length * 2);
    });
  });

  describe("isFull", () => {
    it("should return false when not full", async () => {
      expect(vectorStore.isFull()).toBe(false);
      await vectorStore.addChunks(testChunks);
      expect(vectorStore.isFull()).toBe(false);
    });
  });

  describe("setRetrievalStrategy", () => {
    it("should change retrieval strategy", async () => {
      expect(vectorStore).toBeInstanceOf(VectorStore);

      vectorStore.setRetrievalStrategy(new TopKRetrieval());

      const results = await vectorStore.retrieve("test", 2);
      expect(results).toBeDefined();
    });
  });

  describe("Custom batch size", () => {
    it("should respect custom batch size", async () => {
      const largeChunks = Array.from({ length: 10 }, (_, i) => ({
        id: `chunk-${i}`,
        documentId: "doc-1",
        content: `Chunk content ${i}`,
        startIndex: i * 10,
        endIndex: (i + 1) * 10,
      }));

      await vectorStore.addChunks(largeChunks, 3);

      expect(vectorStore.size()).toBe(10);
    });
  });
});
