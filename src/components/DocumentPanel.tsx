import { useState } from "react";
import { FileText, ChevronRight, FileCode } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { Document, Chunk } from "@/types";

export function DocumentPanel() {
  const { state } = useApp();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);

  const selectedDocument = state.documents.find((doc) => doc.id === selectedDocumentId) || null;

  const documentChunks = state.chunks.filter((chunk) => chunk.documentId === selectedDocumentId);

  const selectedChunk = state.chunks.find((chunk) => chunk.id === selectedChunkId) || null;

  const handleDocumentClick = (documentId: string) => {
    setSelectedDocumentId(documentId === selectedDocumentId ? null : documentId);
    setSelectedChunkId(null);
  };

  const handleChunkClick = (chunkId: string) => {
    setSelectedChunkId(chunkId === selectedChunkId ? null : chunkId);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg h-full flex flex-col">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-800 text-sm">文件与 Chunks</h2>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {state.documents.length} 个文档 · {state.chunks.length} 个 chunks
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <div className="text-xs font-medium text-gray-500 px-2 py-1">文档列表</div>
          {state.documents.length === 0 ? (
            <div className="text-xs text-gray-400 px-2 py-4 text-center">
              暂无上传的文档
            </div>
          ) : (
            <div className="space-y-1">
              {state.documents.map((doc: Document) => (
                <div
                  key={doc.id}
                  onClick={() => handleDocumentClick(doc.id)}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedDocumentId === doc.id
                      ? "bg-blue-50 text-blue-700"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{doc.name}</div>
                    <div className="text-xs text-gray-500">
                      {formatFileSize(doc.size)} · {formatDate(doc.uploadedAt)}
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 flex-shrink-0 transition-transform ${
                      selectedDocumentId === doc.id ? "rotate-90" : ""
                    }`}
                  />
                </div>
              ))}
            </div>
          )}

          {selectedDocument && documentChunks.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-gray-500 px-2 py-1">
                {selectedDocument.name} - Chunks ({documentChunks.length})
              </div>
              <div className="space-y-1">
                {documentChunks.map((chunk: Chunk) => (
                  <div
                    key={chunk.id}
                    onClick={() => handleChunkClick(chunk.id)}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                      selectedChunkId === chunk.id
                        ? "bg-green-50 text-green-700"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <FileCode className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        Chunk {chunk.startIndex + 1}-{chunk.endIndex}
                      </div>
                      <div className="text-xs text-gray-500">
                        {chunk.content.length} 字符
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 flex-shrink-0 transition-transform ${
                        selectedChunkId === chunk.id ? "rotate-90" : ""
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedChunk && (
            <div className="mt-4">
              <div className="text-xs font-medium text-gray-500 px-2 py-1">
                Chunk 内容预览
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-xs text-gray-400 mb-2">
                  位置: {selectedChunk.startIndex + 1} - {selectedChunk.endIndex}
                </div>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap break-all font-mono max-h-64 overflow-y-auto">
                  {selectedChunk.content}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}