import { describe, it, expect, beforeEach } from "vitest";
import { PromptService, defaultTemplates, defaultPromptConfig } from "./index";
import type { RetrievedChunk, Chunk } from "@/types";

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

describe("PromptService", () => {
  let promptService: PromptService;

  beforeEach(() => {
    promptService = new PromptService([...defaultTemplates]);
  });

  describe("Constructor", () => {
    it("should create instance with default templates", () => {
      const service = new PromptService();
      expect(service).toBeInstanceOf(PromptService);
      expect(service.getTemplates().length).toBe(defaultTemplates.length);
    });

    it("should create instance with custom templates", () => {
      const customTemplates = [
        { id: "custom", name: "Custom", template: "{{question}} - {{context}}" },
      ];
      const service = new PromptService(customTemplates);
      expect(service.getTemplates().length).toBe(1);
      expect(service.getTemplates()[0].id).toBe("custom");
    });
  });

  describe("getTemplates", () => {
    it("should return all templates", () => {
      const templates = promptService.getTemplates();
      expect(templates.length).toBe(defaultTemplates.length);
    });

    it("should return a copy of templates", () => {
      const templates = promptService.getTemplates();
      templates.push({ id: "new", name: "New", template: "test" });
      expect(promptService.getTemplates().length).toBe(defaultTemplates.length);
    });
  });

  describe("getTemplateById", () => {
    it("should return template by id", () => {
      const template = promptService.getTemplateById("default");
      expect(template).toBeDefined();
      expect(template?.id).toBe("default");
    });

    it("should return undefined for unknown template id", () => {
      const template = promptService.getTemplateById("unknown");
      expect(template).toBeUndefined();
    });
  });

  describe("addTemplate", () => {
    it("should add new template", () => {
      const newTemplate = { id: "new", name: "New", template: "test" };
      promptService.addTemplate(newTemplate);
      expect(promptService.getTemplates().length).toBe(defaultTemplates.length + 1);
      expect(promptService.getTemplateById("new")).toEqual(newTemplate);
    });

    it("should update existing template", () => {
      const updatedTemplate = { id: "default", name: "Updated", template: "updated" };
      promptService.addTemplate(updatedTemplate);
      expect(promptService.getTemplateById("default")?.name).toBe("Updated");
    });
  });

  describe("removeTemplate", () => {
    it("should remove template by id", () => {
      promptService.removeTemplate("default");
      expect(promptService.getTemplateById("default")).toBeUndefined();
    });

    it("should not throw error for unknown template id", () => {
      expect(() => promptService.removeTemplate("unknown")).not.toThrow();
    });
  });

  describe("buildContext", () => {
    it("should build context from retrieved chunks", () => {
      const chunks = [
        createMockChunk("First chunk content", 0.9),
        createMockChunk("Second chunk content", 0.8),
      ];
      const context = promptService.buildContext(chunks);
      expect(context).toContain("First chunk content");
      expect(context).toContain("Second chunk content");
      expect(context).toContain("相似度: 90.00%");
      expect(context).toContain("相似度: 80.00%");
    });

    it("should handle empty chunks array", () => {
      const context = promptService.buildContext([]);
      expect(context).toBe("");
    });

    it("should respect maxLength parameter", () => {
      const chunks = [
        createMockChunk("A".repeat(500), 0.9),
        createMockChunk("B".repeat(500), 0.8),
      ];
      const context = promptService.buildContext(chunks, 530);
      expect(context.length).toBeLessThanOrEqual(530);
      expect(context).toContain("A".repeat(500).slice(0, 500));
      expect(context).not.toContain("B".repeat(500).slice(0, 500));
    });

    it("should truncate chunks when exceeding maxLength", () => {
      const chunks = [createMockChunk("A".repeat(1000), 0.9)];
      const context = promptService.buildContext(chunks, 100);
      expect(context.length).toBeLessThanOrEqual(100);
      expect(context.endsWith("...")).toBe(true);
    });
  });

  describe("buildPrompt", () => {
    it("should build prompt with default template", () => {
      const question = "What is React?";
      const chunks = [createMockChunk("React is a JavaScript library", 0.85)];
      const prompt = promptService.buildPrompt(question, chunks);

      expect(prompt).toContain(question);
      expect(prompt).toContain("React is a JavaScript library");
      expect(prompt).toContain("基于以下文档内容回答问题");
    });

    it("should use specified template", () => {
      const question = "What is React?";
      const chunks = [createMockChunk("React content", 0.8)];
      const prompt = promptService.buildPrompt(question, chunks, { templateId: "detailed" });

      expect(prompt).toContain("请基于提供的文档内容，详细回答以下问题");
    });

    it("should fallback to first template when specified template not found", () => {
      const service = new PromptService([
        { id: "custom", name: "Custom", template: "Custom: {{question}}" },
      ]);
      const question = "Test";
      const chunks: RetrievedChunk[] = [];
      const prompt = service.buildPrompt(question, chunks, { templateId: "unknown" });

      expect(prompt).toContain("Custom:");
    });

    it("should handle empty retrieved chunks", () => {
      const question = "What is test?";
      const prompt = promptService.buildPrompt(question, []);

      expect(prompt).toContain(question);
      expect(prompt).toContain("基于以下文档内容回答问题");
    });
  });
});

describe("defaultPromptConfig", () => {
  it("should have correct default values", () => {
    expect(defaultPromptConfig.templateId).toBe("default");
    expect(defaultPromptConfig.maxContextLength).toBe(4000);
  });
});

describe("defaultTemplates", () => {
  it("should have expected templates", () => {
    const originalTemplates = [
      { id: "default", name: "默认模板", template: expect.any(String) },
      { id: "detailed", name: "详细回答模板", template: expect.any(String) },
      { id: "summary", name: "总结模板", template: expect.any(String) },
    ];
    expect(defaultTemplates).toEqual(originalTemplates);
  });
});