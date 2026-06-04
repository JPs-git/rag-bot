import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ChunkService,
  RecursiveCharacterChunking,
  FixedSizeChunking,
  defaultChunkConfig,
} from "./index";
import type { ChunkConfig, Document } from "@/types";

describe("RecursiveCharacterChunking", () => {
  let chunking: RecursiveCharacterChunking;

  beforeEach(() => {
    chunking = new RecursiveCharacterChunking();
  });

  it("should have correct name", () => {
    expect(chunking.name).toBe("recursive-character");
  });

  it("should return empty array for empty document", () => {
    const document: Document = {
      id: "test-doc",
      name: "test.txt",
      content: "",
      type: "txt",
      size: 0,
      uploadedAt: new Date(),
    };
    const result = chunking.chunk(document, defaultChunkConfig);
    expect(result).toEqual([]);
  });

  it("should split document into chunks of specified size", () => {
    const text = "a".repeat(1000);
    const document: Document = {
      id: "test-doc",
      name: "test.txt",
      content: text,
      type: "txt",
      size: text.length,
      uploadedAt: new Date(),
    };
    const config: ChunkConfig = {
      chunkSize: 100,
      chunkOverlap: 10,
      separators: ["\n\n", "\n", " "],
    };

    const chunks = chunking.chunk(document, config);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(config.chunkSize);
    });
  });

  it("should respect separator priority", () => {
    const text = "Paragraph1\n\nParagraph2\n\nParagraph3";
    const document: Document = {
      id: "test-doc",
      name: "test.txt",
      content: text,
      type: "txt",
      size: text.length,
      uploadedAt: new Date(),
    };
    const config: ChunkConfig = {
      chunkSize: 20,
      chunkOverlap: 5,
      separators: ["\n\n", "\n", " "],
    };

    const chunks = chunking.chunk(document, config);

    expect(chunks.length).toBeGreaterThan(0);
    const firstChunkContent = chunks[0].content;
    expect(firstChunkContent).toContain("Paragraph1");
  });

  it("should handle Chinese text with Chinese separators", () => {
    const text = "第一段内容。第二段内容！第三段内容？";
    const document: Document = {
      id: "test-doc",
      name: "test.txt",
      content: text,
      type: "txt",
      size: text.length,
      uploadedAt: new Date(),
    };
    const config: ChunkConfig = {
      chunkSize: 10,
      chunkOverlap: 2,
      separators: ["\n\n", "\n", "。", "！", "？", "；", "、", " "],
    };

    const chunks = chunking.chunk(document, config);

    expect(chunks.length).toBeGreaterThan(0);
  });

  it("should set correct chunk indices", () => {
    const text = "Hello World Test";
    const document: Document = {
      id: "test-doc",
      name: "test.txt",
      content: text,
      type: "txt",
      size: text.length,
      uploadedAt: new Date(),
    };
    const config: ChunkConfig = {
      chunkSize: 5,
      chunkOverlap: 1,
      separators: [" "],
    };

    const chunks = chunking.chunk(document, config);

    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((chunk, index) => {
      expect(chunk.id).toBe(`chunk-${index}`);
    });
  });

  it("should trim whitespace from chunk content", () => {
    const text = "  Hello   World  ";
    const document: Document = {
      id: "test-doc",
      name: "test.txt",
      content: text,
      type: "txt",
      size: text.length,
      uploadedAt: new Date(),
    };
    const config: ChunkConfig = {
      chunkSize: 50,
      chunkOverlap: 0,
      separators: [" "],
    };

    const chunks = chunking.chunk(document, config);

    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((chunk) => {
      expect(chunk.content).toBe(chunk.content.trim());
    });
  });

  it("should handle document shorter than chunk size", () => {
    const text = "Short text";
    const document: Document = {
      id: "test-doc",
      name: "test.txt",
      content: text,
      type: "txt",
      size: text.length,
      uploadedAt: new Date(),
    };
    const config: ChunkConfig = {
      chunkSize: 100,
      chunkOverlap: 10,
      separators: ["\n\n", "\n", " "],
    };

    const chunks = chunking.chunk(document, config);

    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe(text);
  });

  it("should handle text with no separators", () => {
    const text = "abcdefghij";
    const document: Document = {
      id: "test-doc",
      name: "test.txt",
      content: text,
      type: "txt",
      size: text.length,
      uploadedAt: new Date(),
    };
    const config: ChunkConfig = {
      chunkSize: 5,
      chunkOverlap: 1,
      separators: [],
    };

    const chunks = chunking.chunk(document, config);

    expect(chunks.length).toBe(2);
  });
});

describe("ChunkService", () => {
  let chunkService: ChunkService;

  beforeEach(() => {
    chunkService = new ChunkService("recursive-character");
  });

  it("should create instance with default strategy", () => {
    expect(chunkService).toBeInstanceOf(ChunkService);
  });

  it("should create instance with custom strategy name", () => {
    const service = new ChunkService("recursive-character");
    expect(service).toBeInstanceOf(ChunkService);
  });

  it("should chunk a single file correctly", async () => {
    const fileContent =
      "Test document content that should be chunked into smaller pieces";
    const file = new File([fileContent], "test.txt", { type: "text/plain" });

    const config: ChunkConfig = {
      chunkSize: 10,
      chunkOverlap: 2,
      separators: [" "],
    };

    const result = await chunkService.chunk(file, config);

    expect(result.document.name).toBe("test.txt");
    expect(result.document.type).toBe("txt");
    expect(result.document.size).toBe(fileContent.length);
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it("should detect markdown files correctly", async () => {
    const file = new File(["# Header"], "test.md", { type: "text/markdown" });
    const result = await chunkService.chunk(file, defaultChunkConfig);

    expect(result.document.type).toBe("md");
  });

  it("should generate unique document IDs", async () => {
    const file1 = new File(["Content 1"], "test1.txt", { type: "text/plain" });
    const file2 = new File(["Content 2"], "test2.txt", { type: "text/plain" });

    const result1 = await chunkService.chunk(file1, defaultChunkConfig);
    const result2 = await chunkService.chunk(file2, defaultChunkConfig);

    expect(result1.document.id).not.toBe(result2.document.id);
  });

  it("should chunk multiple files with progress callback", async () => {
    const files = [
      new File(["Content 1"], "test1.txt", { type: "text/plain" }),
      new File(["Content 2"], "test2.txt", { type: "text/plain" }),
    ];

    const progressCallback = vi.fn();

    const results = await chunkService.chunkFiles(
      files,
      { chunkSize: 100, chunkOverlap: 10, separators: [" "] },
      progressCallback,
    );

    expect(results.length).toBe(2);
    expect(progressCallback).toHaveBeenCalledTimes(2);
    expect(progressCallback).toHaveBeenCalledWith(
      "test1.txt",
      expect.any(Number),
    );
    expect(progressCallback).toHaveBeenCalledWith(
      "test2.txt",
      expect.any(Number),
    );
  });

  it("should handle empty files array", async () => {
    const results = await chunkService.chunkFiles([], defaultChunkConfig);
    expect(results).toEqual([]);
  });

  it("should handle single file in chunkFiles", async () => {
    const files = [new File(["Content"], "test.txt", { type: "text/plain" })];
    const results = await chunkService.chunkFiles(files, defaultChunkConfig);
    expect(results.length).toBe(1);
  });

  it("should set documentId in chunks after processing", async () => {
    const file = new File(["Some content"], "test.txt", { type: "text/plain" });
    const result = await chunkService.chunk(file, defaultChunkConfig);

    expect(
      result.chunks.every((chunk) => chunk.documentId === result.document.id),
    ).toBe(true);
  });
});

describe("FixedSizeChunking", () => {
  let chunking: FixedSizeChunking;

  beforeEach(() => {
    chunking = new FixedSizeChunking();
  });

  it("should have correct name", () => {
    expect(chunking.name).toBe("fixed-size");
  });

  it("should return empty array for empty document", () => {
    const document: Document = {
      id: "test-doc",
      name: "test.txt",
      content: "",
      type: "txt",
      size: 0,
      uploadedAt: new Date(),
    };
    const result = chunking.chunk(document, defaultChunkConfig);
    expect(result).toEqual([]);
  });

  it("should not produce many small chunks near the end", () => {
    const text = "a".repeat(472);
    const document: Document = {
      id: "test-doc",
      name: "test.txt",
      content: text,
      type: "txt",
      size: text.length,
      uploadedAt: new Date(),
    };
    const config: ChunkConfig = {
      chunkSize: 500,
      chunkOverlap: 50,
      separators: [],
    };

    const chunks = chunking.chunk(document, config);

    expect(chunks.length).toBeLessThanOrEqual(2);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("should handle content shorter than chunkSize", () => {
    const text = "Short text";
    const document: Document = {
      id: "test-doc",
      name: "test.txt",
      content: text,
      type: "txt",
      size: text.length,
      uploadedAt: new Date(),
    };
    const config: ChunkConfig = {
      chunkSize: 100,
      chunkOverlap: 10,
      separators: [],
    };

    const chunks = chunking.chunk(document, config);

    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe(text);
  });

  it("should handle chunking with overlap correctly", () => {
    const text = "abcdefghijklmnopqrstuvwxyz";
    const document: Document = {
      id: "test-doc",
      name: "test.txt",
      content: text,
      type: "txt",
      size: text.length,
      uploadedAt: new Date(),
    };
    const config: ChunkConfig = {
      chunkSize: 10,
      chunkOverlap: 2,
      separators: [],
    };

    const chunks = chunking.chunk(document, config);

    expect(chunks.length).toBe(3);
    expect(chunks[0].content).toBe("abcdefghij");
    expect(chunks[1].content).toBe("ijklmnopqr");
    expect(chunks[2].content).toBe("qrstuvwxyz");
  });
});

describe("getChunkingStrategy", () => {
  it("should return strategy by name", async () => {
    const { getChunkingStrategy } = await import("./index");
    const strategy = getChunkingStrategy("recursive-character");
    expect(strategy).toBeDefined();
    expect(strategy?.name).toBe("recursive-character");
  });

  it("should return undefined for unknown strategy", async () => {
    const { getChunkingStrategy } = await import("./index");
    const strategy = getChunkingStrategy("unknown-strategy");
    expect(strategy).toBeUndefined();
  });
});
