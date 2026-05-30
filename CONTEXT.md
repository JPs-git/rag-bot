# RAG Bot - 领域模型与术语表

## 核心概念

### 文档 (Document)
用户上传的文本文件，是知识库的基本单元。当前支持格式：TXT、Markdown。PDF作为未来扩展预留。

### 文档块 (Document Chunk)
文档经过分块处理后的片段，是向量化和检索的基本单位。

### 分块策略 (Chunking Strategy)
将文档分割成块的算法策略。采用策略模式设计，支持扩展。

**当前实现：**
- 递归字符分块策略 (Recursive Character Chunking)

**策略接口：**
- `chunk(document: string, config: ChunkConfig): Chunk[]`

### 分块配置 (Chunk Config)
控制分块行为的参数集合。

**参数：**
- `chunkSize`: 块大小（字符数）
- `chunkOverlap`: 块之间的重叠字符数
- `separators`: 分隔符优先级列表

### 向量库 (Vector Store)
存储文档块向量表示的内存数据结构，session级别生命周期。

### RAG检索 (RAG Retrieval)
根据用户问题向量，从向量库中检索相关文档块的过程。采用策略模式设计。

**当前实现策略：**
- 余弦相似度策略 (Cosine Similarity Strategy)
- Top-K检索策略 (Top-K Retrieval Strategy)

**策略接口：**
- `retrieve(queryVector: number[], config: RetrievalConfig): Chunk[]`

**检索配置 (Retrieval Config)：**
- `topK`: 返回的相关块数量
- `similarityThreshold`: 相似度阈值（可选）

### Ground Truth
RAG回答中引用的原始文档内容，用于验证回答的准确性。

## 技术约束

### 纯前端架构
所有处理在浏览器端完成，无需后端服务器。

### Session级存储
向量库数据仅存在于当前会话，刷新页面后需要重新上传文档。

### 用户自备API Key
LLM调用需要用户提供自己的API密钥（OpenAI、Anthropic等）。
