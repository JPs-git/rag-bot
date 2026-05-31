import { Sender } from '@ant-design/x';
import { useApp } from '@/context/AppContext';

export function ChatInput() {
  const { state, sendMessage } = useApp();

  const handleSubmit = async (content: string) => {
    await sendMessage(content);
  };

  return (
    <div className="border-t border-border bg-bg-primary">
      <Sender
        style={{ padding: '16px 24px' }}
        placeholder="输入问题，AI将基于已上传文档回答..."
        loading={state.isLoading}
        onSubmit={handleSubmit}
        onCancel={() => {}}
        disabled={state.documents.length === 0}
      />
      {state.documents.length === 0 && (
        <div className="text-center text-sm text-text-secondary pb-3">
          请先上传文档后再开始对话
        </div>
      )}
    </div>
  );
}
