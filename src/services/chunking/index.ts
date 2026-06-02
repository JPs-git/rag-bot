import type { Chunk, ChunkConfig, ChunkingStrategy, Document } from "@/types";

export interface ChunkResult {
  document: Document;
  chunks: Chunk[];
}

export class ChunkService {
  private strategy: ChunkingStrategy;

  constructor(strategyName: string = "recursive-character") {
    this.strategy = this.getStrategy(strategyName);
  }

  private getStrategy(name: string): ChunkingStrategy {
    if (name === "recursive-character") {
      return new RecursiveCharacterChunking();
    }
    return new RecursiveCharacterChunking();
  }

  async chunk(file: File, chunkConfig: ChunkConfig): Promise<ChunkResult> {
    const content = await file.text();

    const document: Document = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      content,
      type: file.name.endsWith(".md") ? "md" : "txt",
      size: file.size,
      uploadedAt: new Date(),
    };

    const chunks = this.strategy.chunk(document, chunkConfig);

    return { document, chunks };
  }

  async chunkFiles(
    files: File[],
    chunkConfig: ChunkConfig,
    onProgress?: (fileName: string, chunksCount: number) => void,
  ): Promise<ChunkResult[]> {
    const results: ChunkResult[] = [];

    for (const file of files) {
      const result = await this.chunk(file, chunkConfig);
      results.push(result);
      onProgress?.(file.name, result.chunks.length);
    }

    return results;
  }
}

export const defaultChunkConfig: ChunkConfig = {
  chunkSize: 500,
  chunkOverlap: 50,
  separators: ["\n\n", "\n", "。", "！", "？", "；", "、", " "],
};

export class RecursiveCharacterChunking implements ChunkingStrategy {
  name = "recursive-character";

  chunk(document: Document, config: ChunkConfig): Chunk[] {
    const { chunkSize, chunkOverlap, separators } = config;
    const chunks: Chunk[] = [];
    let currentIndex = 0;
    let chunkId = 0;

    while (currentIndex < document.content.length) {
      let endIndex = Math.min(
        currentIndex + chunkSize,
        document.content.length,
      );
      let chunkContent = document.content.slice(currentIndex, endIndex);

      if (endIndex < document.content.length) {
        let foundSeparator = false;

        for (const separator of separators) {
          const separatorIndex = chunkContent.lastIndexOf(separator);
          if (
            separatorIndex !== -1 &&
            separatorIndex > chunkSize - chunkOverlap
          ) {
            endIndex = currentIndex + separatorIndex + separator.length;
            chunkContent = document.content.slice(currentIndex, endIndex);
            foundSeparator = true;
            break;
          }
        }

        if (!foundSeparator) {
          const spaceIndex = chunkContent.lastIndexOf(" ");
          if (spaceIndex !== -1 && spaceIndex > chunkSize - chunkOverlap) {
            endIndex = currentIndex + spaceIndex + 1;
            chunkContent = document.content.slice(currentIndex, endIndex);
          }
        }
      }

      chunks.push({
        id: `chunk-${chunkId++}`,
        documentId: document.id,
        content: chunkContent.trim(),
        startIndex: currentIndex,
        endIndex: endIndex,
      });

      currentIndex = endIndex;
    }

    return chunks;
  }
}

export const chunkingStrategies: ChunkingStrategy[] = [
  new RecursiveCharacterChunking(),
];

export function getChunkingStrategy(
  name: string,
): ChunkingStrategy | undefined {
  return chunkingStrategies.find((s) => s.name === name);
}
