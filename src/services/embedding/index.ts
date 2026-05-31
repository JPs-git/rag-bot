import { env } from "@huggingface/transformers";

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = "/models/";
env.useBrowserCache = false;

const originalFetch = env.fetch;
env.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await originalFetch(input as string | URL, init);
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;

  if (
    url.includes("/models/") &&
    response.status === 200 &&
    response.headers.get("content-type")?.includes("text/html")
  ) {
    console.warn(`[EMBEDDING] Server returned HTML instead of model file for: ${url}`);
    return new Response(null, { status: 404, statusText: "Not Found" });
  }

  return response;
};

import { pipeline, type Tensor } from "@huggingface/transformers";
import { PERFORMANCE_CONFIG, delay, truncateText } from "@/config/performance";

const MODEL_ID = "Xenova/multilingual-e5-small";

type PipelineFn = (texts: string | string[], options?: Record<string, unknown>) => Promise<unknown>;

function disposeTensor(t: unknown): void {
  if (t && typeof t === "object" && "dispose" in t) {
    try {
      (t as { dispose: () => void }).dispose();
    } catch {
      // 已释放或不可释放，忽略
    }
  }
}

export class EmbeddingService {
  private extractor: PipelineFn | null = null;
  private initPromise: Promise<void> | null = null;

  private async tryInit(): Promise<PipelineFn> {
    const startTime = performance.now();

    const extractor = (await pipeline("feature-extraction", MODEL_ID, {
      local_files_only: true,
      progress_callback: (progress: { status: string; progress?: number; file?: string }) => {
        if (progress.status === "progress" && typeof progress.progress === "number") {
          console.log(`[EMBEDDING] Loading ${progress.file || "model"}: ${Math.round(progress.progress)}%`);
        }
      },
    })) as unknown as PipelineFn;

    console.log(`[EMBEDDING] Model loaded in ${(performance.now() - startTime).toFixed(0)}ms`);
    return extractor;
  }

  async init(): Promise<void> {
    if (this.extractor) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.extractor = await this.tryInit();
      } catch (error) {
        this.initPromise = null;
        throw new Error(
          `模型加载失败。请检查本地模型文件是否存在。\n错误详情: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    })();

    return this.initPromise;
  }

  private async embedOne(text: string): Promise<number[]> {
    if (!this.extractor) {
      await this.init();
    }
    if (!this.extractor) {
      throw new Error("Failed to initialize embedding model");
    }

    const truncated = text.length > PERFORMANCE_CONFIG.MAX_TEXT_LENGTH_PER_EMBED
      ? truncateText(text, PERFORMANCE_CONFIG.MAX_TEXT_LENGTH_PER_EMBED)
      : text;

    const result = await this.extractor(truncated, {
      pooling: "mean",
      normalize: true,
    });

    const tensor = result as unknown as Tensor;
    const embedding: number[] = tensor.tolist()[0] as number[];

    disposeTensor(tensor);

    return embedding;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const startTime = performance.now();
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      const emb = await this.embedOne(texts[i]);
      embeddings.push(emb);

      await delay(0);
    }

    const elapsed = (performance.now() - startTime).toFixed(0);
    console.log(`[EMBEDDING] Embedded ${texts.length} texts in ${elapsed}ms`);

    return embeddings;
  }

  async embedSingle(text: string): Promise<number[]> {
    const results = await this.embed([text]);
    return results[0];
  }

  isInitialized(): boolean {
    return this.extractor !== null;
  }
}

export const embeddingService = new EmbeddingService();
