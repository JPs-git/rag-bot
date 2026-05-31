# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## Project Overview

A browser-based RAG (Retrieval-Augmented Generation) document Q&A assistant built as a single-page React app. Users upload `.txt`/`.md` documents, which are chunked, embedded with a local ONNX model, and stored in an in-memory vector store. Users can then ask questions; relevant chunks are retrieved via cosine similarity and either sent to the OpenAI API for answer generation or returned as demo excerpts if no API key is configured.

The entire RAG pipeline runs client-side: embedding uses `@huggingface/transformers` with a local ONNX model (Xenova/multilingual-e5-small) served from `public/models/`, and vector search is done in-memory with no backend.

## Commands

- `npm run dev` — Start Vite dev server (HMR enabled)
- `npm run build` — Type-check with `tsc -b` then build with Vite
- `npm run lint` — Run ESLint across the project
- `npm run preview` — Preview the production build locally
- `npm run download-model` — Download the embedding model to `public/models/`

## Architecture

```
src/
├── main.tsx                    # Entry point, renders <App />
├── App.tsx                     # Layout: Sidebar + ChatPanel, wrapped in XProvider/ConfigProvider/AppProvider
├── context/AppContext.tsx       # Central state management (useReducer + Context)
├── types/index.ts              # All TypeScript interfaces (Document, Chunk, Vector, Message, AppConfig, AppAction)
├── config/performance.ts       # Performance limits and memory-check utilities
├── services/
│   ├── chunking/index.ts       # RecursiveCharacterChunking strategy
│   ├── embedding/index.ts      # EmbeddingService — wraps @huggingface/transformers pipeline, loads local ONNX model
│   ├── retrieval/index.ts      # CosineSimilarityRetrieval and TopKRetrieval strategies
│   └── vectorStore/index.ts    # VectorStore — in-memory store, orchestrates embedding + retrieval
└── components/
    ├── ChatHistory.tsx          # Renders message list using @ant-design/x Bubble.List
    ├── ChatInput.tsx            # Sender component from @ant-design/x
    ├── ConfigPanel.tsx          # Config form (API key, topK, chunk size/overlap)
    └── FileUploader.tsx         # Upload .txt/.md files with size/count limits
```

### Data Flow

1. **Upload**: `FileUploader` → `AppContext.uploadDocuments()` → reads files → `RecursiveCharacterChunking.chunk()` → `VectorStore.addChunks()` → `EmbeddingService.embed()` (batched) → vectors stored in memory
2. **Query**: `ChatInput` → `AppContext.sendMessage()` → `VectorStore.retrieve()` → `EmbeddingService.embedSingle(query)` → retrieval strategy finds top-K similar chunks → if OpenAI API key set, calls `gpt-3.5-turbo`; otherwise returns demo response with chunk excerpts

### State Management

All state lives in `AppContext` via `useReducer`. The `AppAction` discriminated union handles all state transitions. Config is persisted to `localStorage`. The `embeddingService` and `vectorStore` are module-level singletons that exist outside React's lifecycle.

### Key Libraries

- **UI**: React 19, Ant Design (`antd`), Ant Design X (`@ant-design/x` — chat components like Bubble, Sender, Sources)
- **Embedding**: `@huggingface/transformers` (ONNX Runtime in browser)
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Build**: Vite 6 with `@vitejs/plugin-react`

### Path Aliases

- `@/*` maps to `src/*` (configured in both `vite.config.ts` and `tsconfig.app.json`)

### Local Model Setup

The embedding model must exist at `public/models/Xenova/multilingual-e5-small/` with ONNX weights. `EmbeddingService` is configured for local-only loading (`allowRemoteModels: false`, `local_files_only: true`). It includes a custom fetch interceptor to detect SPA fallback HTML responses and convert them to 404s, preventing the app from silently loading garbage as model data.

### Performance Constraints

Defined in `src/config/performance.ts`. Key limits: max 1MB per file, 5 files total, 3MB total content, 150 chunks, 200 vectors, batch size of 3 with 100ms delay between embedding batches. Memory pressure detection triggers additional delays.
