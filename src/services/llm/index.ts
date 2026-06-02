import type { RetrievedChunk } from "@/types";
import { promptService } from "../prompt";

export interface LLMConfig {
  apiKey: string;
  model: string;
  apiBase?: string;
}

export interface LLMResponse {
  content: string;
  isDemo: boolean;
  prompt?: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export const defaultLLMConfig: LLMConfig = {
  apiKey: "",
  model: "gpt-3.5-turbo",
  apiBase: "https://api.openai.com",
};

export class LLMService {
  private config: LLMConfig;

  constructor(config?: Partial<LLMConfig>) {
    this.config = { ...defaultLLMConfig, ...config };
  }

  setConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LLMConfig {
    return { ...this.config };
  }

  async generate(
    question: string,
    retrievedChunks: RetrievedChunk[],
    config?: Partial<LLMConfig>,
  ): Promise<LLMResponse> {
    const currentConfig = { ...this.config, ...config };
    const prompt = promptService.buildPrompt(question, retrievedChunks);

    if (!currentConfig.apiKey) {
      return this.generateDemoResponse(question, retrievedChunks, prompt);
    }

    return this.callOpenAI(prompt, currentConfig);
  }

  private async generateDemoResponse(
    _question: string,
    retrievedChunks: RetrievedChunk[],
    prompt: string,
  ): Promise<LLMResponse> {
    const template = promptService.getTemplateById("default");
    
    const chunksPreview = retrievedChunks
      .map((rc, i) => `\n${i + 1}. ${rc.chunk.content.slice(0, 150)}...`)
      .join("");

    const content = `
【演示模式】

📋 Prompt 模板：${template?.name || "默认模板"}

---

完整 Prompt 内容：
\`\`\`
${prompt}
\`\`\`

---

🔍 检索到的相关文档片段（Top-${retrievedChunks.length}）：
${retrievedChunks.length > 0 ? chunksPreview : "无"}

---

💡 提示：请在配置面板中输入 OpenAI API Key 以启用真实的 LLM 响应。
    `.trim();

    return {
      content,
      isDemo: true,
      prompt,
      model: "demo",
    };
  }

  private async callOpenAI(
    prompt: string,
    config: LLMConfig,
  ): Promise<LLMResponse> {
    const url = `${config.apiBase}/v1/chat/completions`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || `API请求失败: ${response.status}`);
      }

      const data = await response.json();
      const answer = data.choices[0]?.message?.content || "无法回答该问题";

      return {
        content: answer,
        isDemo: false,
        prompt,
        model: config.model,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error("LLM调用失败");
    }
  }
}

export const llmService = new LLMService();