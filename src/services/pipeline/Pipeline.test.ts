import { describe, it, expect, beforeEach, vi, afterEach, Mock } from "vitest";
import { Pipeline } from "./Pipeline";
import { createDefaultStages, UploadStage, HashStage, DeduplicateStage, ChunkStage, EmbedStage, StoreStage } from "./stages";
import { VectorStore } from "../vectorStore";
import type { PipelineStageType, PipelineState, PipelineStateStore } from "./types";

vi.mock("../embedding", () => ({
  embeddingService: {
    embed: vi.fn().mockImplementation((texts: string[]) => {
      return Promise.resolve(texts.map(() => [0.5, 0.5, 0.5, 0.5, 0.5]));
    }),
    embedSingle: vi.fn().mockImplementation((_text: string) => {
      return Promise.resolve([0.5, 0.5, 0.5, 0.5, 0.5]);
    }),
    init: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
  },
}));

class InMemoryStateStore implements PipelineStateStore {
  private store: Map<string, PipelineState> = new Map();

  async save(state: PipelineState): Promise<void> {
    this.store.set(state.id, state);
  }

  async load(pipelineId: string): Promise<PipelineState | null> {
    return this.store.get(pipelineId) || null;
  }

  async delete(pipelineId: string): Promise<void> {
    this.store.delete(pipelineId);
  }

  async list(): Promise<PipelineState[]> {
    return Array.from(this.store.values());
  }
}

describe("Pipeline", () => {
  let vectorStore: VectorStore;
  let pipeline: Pipeline;
  let stateStore: InMemoryStateStore;

  beforeEach(() => {
    vectorStore = new VectorStore();
    stateStore = new InMemoryStateStore();
    const stages = createDefaultStages(vectorStore);
    pipeline = new Pipeline(stages, stateStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should create instance with stages", () => {
      expect(pipeline).toBeDefined();
      expect(pipeline.getStages().length).toBe(6);
    });
  });

  describe("start", () => {
    it("should execute all stages for a new file", async () => {
      const testFile = new File(["Hello, World!"], "test.txt", { type: "text/plain" });
      const onProgress = vi.fn();

      const result = await pipeline.start(testFile, onProgress);

      expect(result).toBeDefined();
      expect(result.stages.upload.status).toBe("completed");
      expect(result.stages.hash.status).toBe("completed");
      expect(result.stages.deduplicate.status).toBe("completed");
      expect(result.stages.chunk.status).toBe("completed");
      expect(result.stages.embed.status).toBe("completed");
      expect(result.stages.store.status).toBe("completed");
    });

    it("should call onProgress for each stage", async () => {
      const testFile = new File(["Test content"], "test.txt", { type: "text/plain" });
      const onProgress = vi.fn();

      await pipeline.start(testFile, onProgress);

      expect(onProgress).toHaveBeenCalled();
      const stagesCalled = onProgress.mock.calls.map((call) => call[0]);
      expect(stagesCalled).toContain("upload");
      expect(stagesCalled).toContain("hash");
      expect(stagesCalled).toContain("deduplicate");
    });

    it("should return valid pipeline state", async () => {
      const testFile = new File(["Content"], "test.txt", { type: "text/plain" });

      const result = await pipeline.start(testFile);

      expect(result.id).toBeDefined();
      expect(result.fileName).toBe("test.txt");
      expect(result.currentStage).toBe("store");
    });
  });

  describe("Deduplication", () => {
    it("should skip chunking and embedding when file is duplicate", async () => {
      const content = "Duplicate content";
      const file1 = new File([content], "test1.txt", { type: "text/plain" });
      const file2 = new File([content], "test2.txt", { type: "text/plain" });

      await pipeline.start(file1);

      const result2 = await pipeline.start(file2);

      expect(result2.stages.deduplicate.output).toEqual({ isDuplicate: true });
      expect(result2.stages.chunk.status).not.toBe("completed");
      expect(result2.stages.embed.status).not.toBe("completed");
      expect(result2.stages.store.status).not.toBe("completed");
    });

    it("should allow different files to be processed", async () => {
      const file1 = new File(["Content 1"], "test1.txt", { type: "text/plain" });
      const file2 = new File(["Content 2"], "test2.txt", { type: "text/plain" });

      await pipeline.start(file1);
      const result2 = await pipeline.start(file2);

      expect(result2.stages.deduplicate.output).toEqual({ isDuplicate: false });
      expect(result2.stages.chunk.status).toBe("completed");
      expect(result2.stages.store.status).toBe("completed");
    });

    it("should allow re-upload after document deletion", async () => {
      const content = "Test content for re-upload";
      const file1 = new File([content], "test.txt", { type: "text/plain" });
      const file2 = new File([content], "test.txt", { type: "text/plain" });

      const result1 = await pipeline.start(file1);
      const documentId = result1.stages.chunk.output?.documentId;
      expect(documentId).toBeDefined();

      expect(vectorStore.hasDocumentHash(result1.stages.hash.output?.hash || "")).toBe(true);

      vectorStore.deleteDocument(documentId!);

      expect(vectorStore.hasDocumentHash(result1.stages.hash.output?.hash || "")).toBe(false);

      const result2 = await pipeline.start(file2);

      expect(result2.stages.deduplicate.output).toEqual({ isDuplicate: false });
      expect(result2.stages.chunk.status).toBe("completed");
      expect(result2.stages.store.status).toBe("completed");
    });
  });

  describe("Stage execution order", () => {
    it("should execute stages in correct order", async () => {
      const testFile = new File(["Test"], "test.txt", { type: "text/plain" });
      const executionOrder: PipelineStageType[] = [];
      
      const onProgress = (stage: PipelineStageType) => {
        if (!executionOrder.includes(stage)) {
          executionOrder.push(stage);
        }
      };

      await pipeline.start(testFile, onProgress);

      const expectedOrder: PipelineStageType[] = ["upload", "hash", "deduplicate", "chunk", "embed", "store"];
      expect(executionOrder).toEqual(expectedOrder);
    });
  });

  describe("abort", () => {
    it("should abort pipeline execution", async () => {
      const testFile = new File(["Very long content ".repeat(1000)], "test.txt", { type: "text/plain" });
      
      setTimeout(() => {
        pipeline.abort();
      }, 10);

      try {
        await pipeline.start(testFile);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect((error as Error).message).toContain("取消");
      }
    });
  });

  describe("redo", () => {
    it("should redo from specified stage", async () => {
      const testFile = new File(["Test content"], "test.txt", { type: "text/plain" });
      const result1 = await pipeline.start(testFile);

      const onProgress = vi.fn();
      const result2 = await pipeline.redo(result1.id, "chunk", onProgress);

      expect(result2.stages.chunk.status).toBe("completed");
      expect(result2.stages.embed.status).toBe("completed");
      expect(result2.stages.store.status).toBe("completed");
    });
  });

  describe("switchStrategy", () => {
    it("should switch chunking strategy and redo", async () => {
      const testFile = new File(["Test content"], "test.txt", { type: "text/plain" });
      const result1 = await pipeline.start(testFile);

      const result2 = await pipeline.switchStrategy(result1.id, "chunk", "new-strategy");

      expect(result2.stages.chunk.strategy).toBe("new-strategy");
      expect(result2.stages.chunk.status).toBe("completed");
    });
  });
});

describe("Individual Stages", () => {
  describe("UploadStage", () => {
    it("should have correct type", () => {
      const stage = new UploadStage();
      expect(stage.type).toBe("upload");
    });

    it("should return UploadResult", async () => {
      const stage = new UploadStage();
      const input = { content: "test", fileName: "test.txt", size: 4, type: "txt" as const };
      
      const result = await stage.execute(input, { state: {} as PipelineState });

      expect(result).toEqual(input);
    });
  });

  describe("HashStage", () => {
    it("should have correct type", () => {
      const stage = new HashStage();
      expect(stage.type).toBe("hash");
    });

    it("should generate SHA-256 hash", async () => {
      const stage = new HashStage();
      const input = { content: "test content", fileName: "test.txt", size: 12, type: "txt" as const };
      
      const result = await stage.execute(input, { state: {} as PipelineState });

      expect(result.hash).toHaveLength(64);
      expect(result.algorithm).toBe("SHA-256");
    });
  });

  describe("DeduplicateStage", () => {
    it("should have correct type", () => {
      const stage = new DeduplicateStage(new VectorStore());
      expect(stage.type).toBe("deduplicate");
    });

    it("should detect duplicate when hash exists", async () => {
      const vs = new VectorStore();
      const stage = new DeduplicateStage(vs);
      vs.addDocumentHash("test-hash");
      
      const result = await stage.execute({ hash: "test-hash", algorithm: "SHA-256" }, { state: {} as PipelineState });

      expect(result.isDuplicate).toBe(true);
    });

    it("should not detect duplicate when hash does not exist", async () => {
      const vs = new VectorStore();
      const stage = new DeduplicateStage(vs);
      
      const result = await stage.execute({ hash: "new-hash", algorithm: "SHA-256" }, { state: {} as PipelineState });

      expect(result.isDuplicate).toBe(false);
    });
  });

  describe("ChunkStage", () => {
    it("should have correct type", () => {
      const stage = new ChunkStage();
      expect(stage.type).toBe("chunk");
    });

    it("should support strategy switching", () => {
      const stage = new ChunkStage();
      expect(stage.getCurrentStrategy()).toBe("recursive-character");
      
      stage.setStrategy("sentence-split");
      expect(stage.getCurrentStrategy()).toBe("sentence-split");
    });

    it("should use chunk config from constructor", () => {
      const customConfig = { chunkSize: 100, chunkOverlap: 10, separators: ["\n\n", "\n"] };
      const stage = new ChunkStage(customConfig);
      
      expect(stage.getChunkConfig()).toEqual(customConfig);
    });

    it("should use default chunk config when not provided", () => {
      const stage = new ChunkStage();
      
      expect(stage.getChunkConfig()).toEqual({
        chunkSize: 500,
        chunkOverlap: 50,
        separators: ["\n\n", "\n", "。", "！", "？", "；", "、", " "],
      });
    });

    it("should produce different chunk counts with different chunk sizes", async () => {
      const longContent = "A".repeat(1000);
      const input = { content: longContent, fileName: "test.txt", size: 1000, type: "txt" as const };
      
      const smallChunkStage = new ChunkStage({ chunkSize: 100, chunkOverlap: 10, separators: [" "] });
      const largeChunkStage = new ChunkStage({ chunkSize: 500, chunkOverlap: 50, separators: [" "] });
      
      const smallResult = await smallChunkStage.execute(input, { state: {} as PipelineState });
      const largeResult = await largeChunkStage.execute(input, { state: {} as PipelineState });
      
      expect(smallResult.chunks.length).toBeGreaterThan(largeResult.chunks.length);
    });
  });

  describe("EmbedStage", () => {
    it("should have correct type", () => {
      const stage = new EmbedStage();
      expect(stage.type).toBe("embed");
    });
  });

  describe("StoreStage", () => {
    it("should have correct type", () => {
      const stage = new StoreStage(new VectorStore());
      expect(stage.type).toBe("store");
    });
  });
});
