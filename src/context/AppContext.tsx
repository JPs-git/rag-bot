import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useState,
} from "react";
import type { AppState, AppAction, Message, AppConfig } from "@/types";
import { ChunkService } from "@/services/chunking";
import { defaultRetrievalConfig } from "@/services/retrieval";
import { vectorStore } from "@/services/vectorStore";
import { embeddingService } from "@/services/embedding";
import { PERFORMANCE_CONFIG } from "@/config/performance";

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
      return { ...initialState, config: state.config };

    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  uploadDocuments: (files: File[]) => Promise<void>;
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
    async (files: File[]) => {
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

      const chunkService = new ChunkService();
      const chunkResults = await chunkService.chunkFiles(
        files,
        state.config.chunkConfig,
      );

      for (const result of chunkResults) {
        dispatch({ type: "ADD_DOCUMENTS", payload: [result.document] });
      }

      const allChunks = chunkResults.flatMap((result) => result.chunks);

      if (allChunks.length > 0) {
        await vectorStore.addChunks(allChunks);
      }

      dispatch({ type: "SET_EMBEDDING", payload: false });
    },
    [state.config.chunkConfig, isModelReady],
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

        const context = retrievedChunks
          .map(
            (rc) =>
              `[文档片段]\n${rc.chunk.content}\n[相似度: ${(rc.similarity * 100).toFixed(2)}%]`,
          )
          .join("\n\n");

        const prompt = `基于以下文档内容回答问题：\n\n${context}\n\n问题：${content}\n\n请用中文回答，尽量简洁。`;

        let answer = "";
        const sources = retrievedChunks;

        if (state.config.openaiApiKey) {
          const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${state.config.openaiApiKey}`,
              },
              body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                stream: false,
              }),
            },
          );

          if (!response.ok) {
            throw new Error("API请求失败");
          }

          const data = await response.json();
          answer = data.choices[0]?.message?.content || "无法回答该问题";
        } else {
          answer = `这是一个演示回复。\n\n检索到的相关文档片段（Top-${retrievedChunks.length}）：\n\n${retrievedChunks
            .map((rc, i) => `${i + 1}. ${rc.chunk.content.slice(0, 100)}...`)
            .join("\n\n")}`;
        }

        const assistantMessage: Message = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: answer,
          sources,
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

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        uploadDocuments,
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
