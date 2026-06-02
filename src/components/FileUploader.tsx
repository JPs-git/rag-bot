import { Upload, List, Progress, Button, message, Alert } from "antd";
import {
  FileTextOutlined,
  DeleteOutlined,
  UploadOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { useApp } from "@/context/AppContext";
import { PERFORMANCE_CONFIG } from "@/config/performance";
import type { UploadFile } from "antd";

export function FileUploader() {
  const { state, uploadDocuments, deleteDocument, isModelReady } = useApp();

  const fileList: UploadFile[] = state.documents.map((doc) => ({
    uid: doc.id,
    name: doc.name,
    status: "done",
    size: doc.size,
  }));

  const handleUpload = async (file: File) => {
    if (!isModelReady) {
      message.error("模型正在加载中，请稍候...");
      return false;
    }

    if (file.size > PERFORMANCE_CONFIG.MAX_FILE_SIZE) {
      message.error(
        `文件大小不能超过 ${(PERFORMANCE_CONFIG.MAX_FILE_SIZE / 1024 / 1024).toFixed(1)}MB`,
      );
      return false;
    }

    if (state.documents.length >= PERFORMANCE_CONFIG.MAX_FILE_COUNT) {
      message.error(`最多只能上传 ${PERFORMANCE_CONFIG.MAX_FILE_COUNT} 个文件`);
      return false;
    }

    await uploadDocuments([file]);
    return false;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      {!isModelReady && (
        <Alert
          message="模型加载中..."
          description="首次使用时需要加载 AI 模型，请稍候片刻..."
          type="info"
          showIcon
          icon={<LoadingOutlined />}
        />
      )}

      <Upload.Dragger
        name="file"
        multiple
        accept=".txt,.md"
        showUploadList={false}
        beforeUpload={handleUpload}
        disabled={state.isEmbedding || !isModelReady}
      >
        <p className="ant-upload-drag-icon">
          {isModelReady ? <UploadOutlined /> : <LoadingOutlined />}
        </p>
        <p className="ant-upload-text">
          {isModelReady ? "点击或拖拽上传文档" : "模型加载中..."}
        </p>
        <p className="ant-upload-hint">
          支持 .txt 和 .md 格式
          <br />
          单文件最大 {formatSize(PERFORMANCE_CONFIG.MAX_FILE_SIZE)}，最多{" "}
          {PERFORMANCE_CONFIG.MAX_FILE_COUNT} 个文件
          <br />
          总大小限制 {formatSize(PERFORMANCE_CONFIG.MAX_TOTAL_CONTENT_SIZE)}
        </p>
      </Upload.Dragger>

      {state.isEmbedding && (
        <Progress percent={99} status="active" size="small" />
      )}

      {fileList.length > 0 && (
        <List
          size="small"
          dataSource={fileList}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  key="delete"
                  onClick={() => deleteDocument(item.uid!)}
                />,
              ]}
            >
              <List.Item.Meta
                avatar={<FileTextOutlined />}
                title={<span className="text-sm">{item.name}</span>}
                description={formatSize(item.size!)}
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
