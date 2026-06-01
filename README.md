# RAG Bot - 浏览器端 RAG 文档问答助手

一个基于浏览器的 RAG (检索增强生成) 文档问答应用，完全在客户端运行。

## 功能特性

- 上传 .txt 和 .md 文档
- 本地 ONNX 模型进行嵌入（无需后端）
- 内存向量存储与相似度检索
- OpenAI API 集成用于回答生成
- 纯浏览器端运行，隐私安全

## 快速开始

### 前置条件

- Node.js 18+
- npm 或 yarn

### 安装步骤

1. 安装依赖
```bash
npm install
```

2. 下载嵌入模型（必需）
```bash
npm run download-model
```

3. 启动开发服务器
```bash
npm run dev
```

4. 在浏览器中打开显示的地址（通常是 http://localhost:5173）

## 可用命令

- `npm run dev` - 启动开发服务器（支持 HMR）
- `npm run build` - 构建生产版本
- `npm run preview` - 预览生产构建
- `npm run lint` - 运行 ESLint 检查
- `npm run download-model` - 下载嵌入模型到 public/models/
- `npm run test` - 运行 Vitest 测试

## 项目架构

```
src/
├── main.tsx                    # 入口文件
├── App.tsx                     # 主应用布局
├── context/AppContext.tsx      # 应用状态管理
├── types/index.ts              # TypeScript 类型定义
├── config/performance.ts       # 性能配置
├── services/
│   ├── chunking/index.ts       # 文档分块策略
│   ├── embedding/index.ts      # 嵌入服务（本地 ONNX 模型）
│   ├── retrieval/index.ts      # 检索策略
│   └── vectorStore/index.ts    # 向量存储
└── components/
    ├── ChatHistory.tsx         # 聊天历史
    ├── ChatInput.tsx           # 聊天输入
    ├── ConfigPanel.tsx         # 配置面板
    └── FileUploader.tsx        # 文件上传
```

## 技术栈

- **UI**: React 19, Ant Design, Ant Design X
- **嵌入**: @huggingface/transformers (浏览器 ONNX Runtime)
- **样式**: Tailwind CSS v4
- **构建**: Vite 6
- **测试**: Vitest

## 模型说明

嵌入模型使用 [Xenova/multilingual-e5-small](https://huggingface.co/Xenova/multilingual-e5-small)，支持多语言文本嵌入。

由于模型文件较大（~118MB），不直接提交到 Git 仓库。首次使用前请运行 `npm run download-model` 下载模型文件。

## License

MIT
