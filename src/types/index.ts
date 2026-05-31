export interface Document {
  id: string;
  name: string;
  content: string;
  type: "txt" | "md";
  size: number;
  uploadedAt: Date;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

export interface ChunkConfig {
  chunkSize: number;
  chunkOverlap: number;
  separators: string[];
}

export interface ChunkingStrategy {
  name: string;
  chunk(document: string, config: ChunkConfig): Chunk[];
}

export interface Vector {
  chunkId: string;
  embedding: number[];
}

export interface RetrievalConfig {
  topK: number;
  similarityThreshold?: number;
}

export interface RetrievedChunk {
  chunk: Chunk;
  similarity: number;
}

export interface RetrievalStrategy {
  name: string;
  retrieve(
    queryVector: number[],
    vectors: Vector[],
    chunks: Chunk[],
    config: RetrievalConfig,
  ): RetrievedChunk[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: RetrievedChunk[];
  timestamp: Date;
}

export interface AppConfig {
  chunkConfig: ChunkConfig;
  retrievalConfig: RetrievalConfig;
  openaiApiKey: string;
  embeddingModel: string;
}

export interface AppState {
  documents: Document[];
  messages: Message[];
  config: AppConfig;
  isLoading: boolean;
  isEmbedding: boolean;
  error: string | null;
}

export type AppAction =
  | { type: "ADD_DOCUMENTS"; payload: Document[] }
  | { type: "ADD_MESSAGE"; payload: Message }
  | {
      type: "UPDATE_MESSAGE";
      payload: { id: string; content: string; sources?: RetrievedChunk[] };
    }
  | { type: "SET_CONFIG"; payload: Partial<AppConfig> }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_EMBEDDING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "CLEAR_SESSION" };
