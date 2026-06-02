import { describe, it, expect, beforeEach, vi } from "vitest";
import { LLMService, defaultLLMConfig, llmService } from "./index";
import type { RetrievedChunk, Chunk } from "@/types";

const fetchMock = vi.fn();

describe("LLMService", () => {
  let llmService: LLMService;

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    llmService = new LLMService();
    vi.clearAllMocks();
  });

  describe("Constructor", () => {
    it("should create instance with default config", () => {
      expect(llmService).toBeInstanceOf(LLMService);
      expect(llmService.getConfig()).toEqual(defaultLLMConfig);
    });

    it("should create instance with custom config", () => {
      const customConfig = { apiKey: "test-key", model: "gpt-4" };
      const service = new LLMService(customConfig);
      expect(service.getConfig().apiKey).toBe("test-key");
      expect(service.getConfig().model).toBe("gpt-4");
    });
  });

  describe("setConfig", () => {
    it("should update config", () => {
      llmService.setConfig({ apiKey: "new-key" });
      expect(llmService.getConfig().apiKey).toBe("new-key");
    });

    it("should preserve existing config values", () => {
      llmService.setConfig({ apiKey: "new-key" });
      expect(llmService.getConfig().model).toBe(defaultLLMConfig.model);
    });
  });

  describe("getConfig", () => {
    it("should return a copy of config", () => {
      const config = llmService.getConfig();
      config.apiKey = "modified";
      expect(llmService.getConfig().apiKey).toBe(defaultLLMConfig.apiKey);
    });
  });

  describe("generate - Demo Mode", () => {
    it("should return demo response when no apiKey is provided", async () => {
      const question = "What is React?";
      const chunks = [createMockChunk("React is a JS library", 0.85)];

      const response = await llmService.generate(question, chunks);

      expect(response.isDemo).toBe(true);
      expect(response.content).toContain("【演示模式】");
      expect(response.content).toContain("Prompt 模板");
      expect(response.content).toContain("完整 Prompt 内容");
      expect(response.content).toContain("React is a JS library");
      expect(response.prompt).toBeDefined();
      expect(response.model).toBe("demo");
    });

    it("should include chunk previews in demo response", async () => {
      const question = "Test";
      const chunks = [
        createMockChunk("First chunk content here", 0.9),
        createMockChunk("Second chunk content here", 0.8),
      ];

      const response = await llmService.generate(question, chunks);

      expect(response.content).toContain("First chunk content here");
      expect(response.content).toContain("Second chunk content here");
      expect(response.content).toContain("Top-2");
    });

    it("should handle empty chunks in demo mode", async () => {
      const question = "Test";
      const chunks: RetrievedChunk[] = [];

      const response = await llmService.generate(question, chunks);

      expect(response.isDemo).toBe(true);
      expect(response.content).toContain("无");
    });
  });

  describe("generate - API Mode", () => {
    it("should call OpenAI API when apiKey is provided", async () => {
      const mockResponse = {
        choices: [{ message: { content: "AI response content" } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const question = "What is React?";
      const chunks = [createMockChunk("React content", 0.8)];

      await llmService.generate(question, chunks, { apiKey: "sk-test-key" });

      expect(fetchMock).toHaveBeenCalled();
      const fetchArgs = fetchMock.mock.calls[0];
      expect(fetchArgs[0]).toBe("https://api.openai.com/v1/chat/completions");
      expect(fetchArgs[1].method).toBe("POST");
      expect(fetchArgs[1].headers.Authorization).toBe("Bearer sk-test-key");
    });

    it("should return API response correctly", async () => {
      const mockResponse = {
        choices: [{ message: { content: "AI response content" } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const question = "What is React?";
      const chunks = [createMockChunk("React content", 0.8)];

      const response = await llmService.generate(question, chunks, { apiKey: "sk-test-key" });

      expect(response.isDemo).toBe(false);
      expect(response.content).toBe("AI response content");
      expect(response.model).toBe("gpt-3.5-turbo");
      expect(response.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
    });

    it("should handle API error", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: "API Error" } }),
      });

      const question = "What is React?";
      const chunks = [createMockChunk("React content", 0.8)];

      await expect(
        llmService.generate(question, chunks, { apiKey: "sk-test-key" })
      ).rejects.toThrow("API Error");
    });

    it("should handle network error", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));

      const question = "What is React?";
      const chunks = [createMockChunk("React content", 0.8)];

      await expect(
        llmService.generate(question, chunks, { apiKey: "sk-test-key" })
      ).rejects.toThrow("Network error");
    });

    it("should use custom apiBase", async () => {
      const mockResponse = {
        choices: [{ message: { content: "Custom API response" } }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const question = "Test";
      const chunks = [createMockChunk("Content", 0.8)];

      await llmService.generate(question, chunks, {
        apiKey: "sk-test-key",
        apiBase: "https://custom.api.com",
      });

      const fetchArgs = fetchMock.mock.calls[0];
      expect(fetchArgs[0]).toBe("https://custom.api.com/v1/chat/completions");
    });

    it("should use custom model", async () => {
      const mockResponse = {
        choices: [{ message: { content: "GPT-4 response" } }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const question = "Test";
      const chunks = [createMockChunk("Content", 0.8)];

      const response = await llmService.generate(question, chunks, {
        apiKey: "sk-test-key",
        model: "gpt-4",
      });

      expect(response.model).toBe("gpt-4");
    });
  });
});

describe("defaultLLMConfig", () => {
  it("should have correct default values", () => {
    expect(defaultLLMConfig.apiKey).toBe("");
    expect(defaultLLMConfig.model).toBe("gpt-3.5-turbo");
    expect(defaultLLMConfig.apiBase).toBe("https://api.openai.com");
  });
});

describe("llmService singleton", () => {
  it("should be an instance of LLMService", () => {
    expect(llmService).toBeInstanceOf(LLMService);
  });

  it("should use default config", () => {
    expect(llmService.getConfig()).toEqual(defaultLLMConfig);
  });
});

function createMockChunk(content: string, similarity: number = 0.8): RetrievedChunk {
  const chunk: Chunk = {
    id: `chunk-${Math.random().toString(36).substr(2, 9)}`,
    documentId: "doc-1",
    content,
    startIndex: 0,
    endIndex: content.length,
  };
  return { chunk, similarity };
}