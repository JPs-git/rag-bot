import type { RetrievedChunk } from "@/types";

export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
}

export interface PromptConfig {
  templateId: string;
  maxContextLength?: number;
}

export const defaultPromptConfig: PromptConfig = {
  templateId: "default",
  maxContextLength: 4000,
};

export const defaultTemplates: PromptTemplate[] = [
  {
    id: "default",
    name: "默认模板",
    template: `基于以下文档内容回答问题：

{{context}}

问题：{{question}}

请用中文回答，尽量简洁。`,
  },
  {
    id: "detailed",
    name: "详细回答模板",
    template: `请基于提供的文档内容，详细回答以下问题。

参考文档：
{{context}}

问题：{{question}}

要求：
1. 回答要基于提供的文档内容
2. 如果文档中没有相关信息，请明确说明
3. 回答要详细、有条理
4. 使用中文回答`,
  },
  {
    id: "summary",
    name: "总结模板",
    template: `请根据以下文档内容，对用户问题进行总结回答。

文档内容：
{{context}}

用户问题：{{question}}

请用简洁的语言给出总结性回答。`,
  },
];

export class PromptService {
  private templates: PromptTemplate[];

  constructor(templates?: PromptTemplate[]) {
    this.templates = templates || defaultTemplates;
  }

  getTemplates(): PromptTemplate[] {
    return [...this.templates];
  }

  getTemplateById(templateId: string): PromptTemplate | undefined {
    return this.templates.find((t) => t.id === templateId);
  }

  addTemplate(template: PromptTemplate): void {
    const existingIndex = this.templates.findIndex((t) => t.id === template.id);
    if (existingIndex >= 0) {
      this.templates[existingIndex] = template;
    } else {
      this.templates.push(template);
    }
  }

  removeTemplate(templateId: string): void {
    this.templates = this.templates.filter((t) => t.id !== templateId);
  }

  buildContext(chunks: RetrievedChunk[], maxLength?: number): string {
    const targetLength = maxLength || 4000;
    let context = "";
    let currentLength = 0;

    for (const chunk of chunks) {
      const chunkText = `[文档片段]\n${chunk.chunk.content}\n[相似度: ${(chunk.similarity * 100).toFixed(2)}%]`;
      const chunkLength = chunkText.length;

      const separatorLength = context ? 2 : 0;

      if (currentLength + separatorLength + chunkLength <= targetLength) {
        if (context) {
          context += "\n\n";
        }
        context += chunkText;
        currentLength += separatorLength + chunkLength;
      } else {
        const remainingLength =
          targetLength - currentLength - separatorLength - 3;
        if (remainingLength > 0) {
          if (context) {
            context += "\n\n";
          }
          context += chunkText.slice(0, remainingLength) + "...";
          break;
        }
        break;
      }
    }

    return context;
  }

  buildPrompt(
    question: string,
    retrievedChunks: RetrievedChunk[],
    config?: Partial<PromptConfig>,
  ): string {
    const promptConfig = { ...defaultPromptConfig, ...config };
    const template =
      this.getTemplateById(promptConfig.templateId) || this.templates[0];

    const context = this.buildContext(
      retrievedChunks,
      promptConfig.maxContextLength,
    );

    return template.template
      .replace("{{context}}", context)
      .replace("{{question}}", question);
  }
}

export const promptService = new PromptService();
