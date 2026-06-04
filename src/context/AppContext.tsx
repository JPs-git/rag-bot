import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useState,
} from "react";
import type { AppState, AppAction, Message, AppConfig } from "@/types";
import type { UploadResult } from "@/types/upload";
import { defaultRetrievalConfig } from "@/services/retrieval";
import { vectorStore } from "@/services/vectorStore";
import { embeddingService } from "@/services/embedding";
import { llmService } from "@/services/llm";
import { PERFORMANCE_CONFIG } from "@/config/performance";
import {
  Pipeline,
  createDefaultStages,
  type PipelineStageType,
} from "@/services/pipeline";

const defaultConfig: AppConfig = {
  chunkConfig: {
    chunkSize: PERFORMANCE_CONFIG.MAX_CHUNK_SIZE,
    chunkOverlap: PERFORMANCE_CONFIG.CHUNK_OVERLAP,
    separators: ["\n\n", "\n", "。", "！", "？", "；", "、", " "],
  },
  retrievalConfig: defaultRetrievalConfig,
  openaiApiKey: "",
  embeddingModel: "Xenova/all-MiniLM-L6-v2",
};

const initialState: AppState = {
  documents: [],
  chunks: [],
  messages: [],
  config: defaultConfig,
  isLoading: false,
  isEmbedding: false,
  error: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "ADD_DOCUMENTS":
      return { ...state, documents: [...state.documents, ...action.payload] };

    case "ADD_CHUNKS":
      return { ...state, chunks: [...state.chunks, ...action.payload] };

    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };

    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.payload.id
            ? {
                ...msg,
                content: action.payload.content,
                sources: action.payload.sources,
              }
            : msg,
        ),
      };

    case "SET_CONFIG":
      return { ...state, config: { ...state.config, ...action.payload } };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_EMBEDDING":
      return { ...state, isEmbedding: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "CLEAR_SESSION":
      vectorStore.clear();
      return { ...initialState, config: state.config, chunks: [] };

    case "DELETE_DOCUMENT":
      return {
        ...state,
        documents: state.documents.filter((doc) => doc.id !== action.payload),
        chunks: state.chunks.filter(
          (chunk) => chunk.documentId !== action.payload,
        ),
      };

    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  uploadDocuments: (files: File[]) => Promise<UploadResult>;
  deleteDocument: (documentId: string) => void;
  sendMessage: (content: string) => Promise<void>;
  updateConfig: (config: Partial<AppConfig>) => void;
  clearSession: () => void;
  isModelReady: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState, (initial) => {
    const savedConfig = localStorage.getItem("rag-bot-config");
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        return { ...initial, config: { ...initial.config, ...config } };
      } catch {
        return initial;
      }
    }
    return initial;
  });

  const [isModelReady, setIsModelReady] = useState(false);

  useEffect(() => {
    console.log("=".repeat(60));
    console.log("RAG Bot - Page Load");
    console.log("=".repeat(60));

    embeddingService
      .init()
      .then(() => {
        setIsModelReady(true);
        console.log("[APP] Model ready");
      })
      .catch((error) => {
        console.error("[APP] Model preload failed:", error);
        dispatch({
          type: "SET_ERROR",
          payload: "模型加载失败，请刷新页面重试",
        });
      });
  }, []);

  useEffect(() => {
    localStorage.setItem("rag-bot-config", JSON.stringify(state.config));
  }, [state.config]);

  const uploadDocuments = useCallback(
    async (files: File[]): Promise<UploadResult> => {
      dispatch({ type: "SET_ERROR", payload: null });

      if (!isModelReady) {
        throw new Error("模型正在加载中，请稍候...");
      }

      if (files.length > PERFORMANCE_CONFIG.MAX_FILE_COUNT) {
        throw new Error(
          `最多只能上传 ${PERFORMANCE_CONFIG.MAX_FILE_COUNT} 个文件`,
        );
      }

      let totalSize = 0;
      for (const file of files) {
        if (file.size > PERFORMANCE_CONFIG.MAX_FILE_SIZE) {
          throw new Error(
            `文件 ${file.name} 超过大小限制 (${(PERFORMANCE_CONFIG.MAX_FILE_SIZE / 1024 / 1024).toFixed(1)}MB)`,
          );
        }
        totalSize += file.size;
      }

      if (totalSize > PERFORMANCE_CONFIG.MAX_TOTAL_CONTENT_SIZE) {
        throw new Error(
          `总文件大小超过限制 (${(PERFORMANCE_CONFIG.MAX_TOTAL_CONTENT_SIZE / 1024 / 1024).toFixed(1)}MB)`,
        );
      }

      if (vectorStore.isFull()) {
        throw new Error(`向量存储已满，请先清除会话`);
      }

      dispatch({ type: "SET_EMBEDDING", payload: true });

      const stages = createDefaultStages(vectorStore, state.config.chunkConfig);
      const pipeline = new Pipeline(stages);

      const result: UploadResult = {
        successCount: 0,
        skippedCount: 0,
        skippedFiles: [],
        failedCount: 0,
        failedFiles: [],
      };

      for (const file of files) {
        try {
          const onProgress = (
            stage: PipelineStageType,
            progress: number,
            message?: string,
          ) => {
            console.log(`[Pipeline] ${stage}: ${progress}% - ${message}`);
          };

          const pipelineState = await pipeline.start(file, onProgress);

          const chunkOutput = pipelineState.stages.chunk.output as {
            documentId: string;
            chunks: {
              id: string;
              documentId: string;
              content: string;
              startIndex: number;
              endIndex: number;
            }[];
          };
          if (!chunkOutput) {
            const deduplicateOutput = pipelineState.stages.deduplicate
              .output as {
              isDuplicate?: boolean;
            };
            if (deduplicateOutput?.isDuplicate) {
              console.log(`[Upload] 文件 ${file.name} 已存在，跳过`);
              result.skippedCount++;
              result.skippedFiles.push(file.name);
              continue;
            }
          }
          if (chunkOutput) {
            const document = {
              id: chunkOutput.documentId,
              name: file.name,
              content: (
                pipelineState.stages.upload.output as { content: string }
              ).content,
              type: file.name.endsWith(".md")
                ? ("md" as const)
                : ("txt" as const),
              size: file.size,
              uploadedAt: new Date(),
            };
            dispatch({ type: "ADD_DOCUMENTS", payload: [document] });
            dispatch({ type: "ADD_CHUNKS", payload: chunkOutput.chunks });
            result.successCount++;
          }

          console.log(`[Upload] 文件 ${file.name} 处理完成`);
        } catch (error) {
          console.error(`[Upload] 文件 ${file.name} 处理失败:`, error);
          result.failedCount++;
          result.failedFiles.push({
            name: file.name,
            error: error instanceof Error ? error.message : "未知错误",
          });
        }
      }

      dispatch({ type: "SET_EMBEDDING", payload: false });
      return result;
    },
    [isModelReady],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      };
      dispatch({ type: "ADD_MESSAGE", payload: userMessage });

      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        const retrievedChunks = await vectorStore.retrieve(
          content,
          state.config.retrievalConfig.topK,
          state.config.retrievalConfig.similarityThreshold,
        );

        const llmResponse = await llmService.generate(
          content,
          retrievedChunks,
          {
            apiKey: state.config.openaiApiKey,
          },
        );

        const assistantMessage: Message = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: llmResponse.content,
          sources: retrievedChunks,
          timestamp: new Date(),
        };
        dispatch({ type: "ADD_MESSAGE", payload: assistantMessage });
      } catch (error) {
        dispatch({
          type: "SET_ERROR",
          payload: error instanceof Error ? error.message : "发送失败",
        });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [
      state.config.retrievalConfig.topK,
      state.config.retrievalConfig.similarityThreshold,
      state.config.openaiApiKey,
    ],
  );

  const updateConfig = useCallback((config: Partial<AppConfig>) => {
    dispatch({ type: "SET_CONFIG", payload: config });
  }, []);

  const clearSession = useCallback(() => {
    dispatch({ type: "CLEAR_SESSION" });
  }, []);

  const deleteDocument = useCallback((documentId: string) => {
    dispatch({ type: "DELETE_DOCUMENT", payload: documentId });
    vectorStore.deleteDocument(documentId);
  }, []);

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        uploadDocuments,
        deleteDocument,
        sendMessage,
        updateConfig,
        clearSession,
        isModelReady,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
