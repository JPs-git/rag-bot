import { XProvider } from '@ant-design/x';
import { Welcome, Prompts } from '@ant-design/x';
import { ConfigProvider, Flex, Avatar } from 'antd';
import { AppProvider, useApp } from '@/context/AppContext';
import { FileUploader } from '@/components/FileUploader';
import { ChatHistory } from '@/components/ChatHistory';
import { ChatInput } from '@/components/ChatInput';
import { ConfigPanel } from '@/components/ConfigPanel';
import { FileText, Bot, Settings, AlertCircle } from 'lucide-react';

function ChatPanel() {
  const { state } = useApp();
  const hasMessages = state.messages.length > 0;

  return (
    <Flex vertical className="h-full bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
        <Flex align="center" gap={12}>
          <Avatar icon={<Bot />} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} size={40} />
          <div>
            <h1 className="text-lg font-semibold">RAG 文档问答助手</h1>
            <p className="text-blue-100 text-sm">基于文档内容智能回答</p>
          </div>
        </Flex>
        <Flex align="center" gap={8}>
          <span className="px-3 py-1 bg-white/10 rounded-full text-sm">
            {state.documents.length} 个文档
          </span>
          {state.isLoading && (
            <span className="px-3 py-1 bg-white/10 rounded-full text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              生成中...
            </span>
          )}
        </Flex>
      </div>
      
      <Flex flex={1} vertical style={{ overflow: 'hidden' }}>
        {hasMessages ? (
          <div className="flex-1 overflow-y-auto">
            <ChatHistory messages={state.messages} />
          </div>
        ) : (
          <Flex vertical flex={1} align="center" justify="center" gap={24} style={{ padding: 32 }}>
            <Welcome
              title="你好！我是 RAG 助手"
              description={state.documents.length > 0 
                ? `已加载 ${state.documents.length} 个文档，请开始提问` 
                : '请先上传文档，然后开始提问'
              }
              icon={<Avatar icon={<Bot />} size={64} style={{ backgroundColor: '#1677ff' }} />}
              variant="borderless"
            />
            {state.documents.length === 0 && (
              <Prompts
                title="快速开始"
                items={[
                  { key: '1', icon: <FileText size={20} />, label: '如何上传文档？', description: '在左侧面板点击上传按钮' },
                  { key: '2', icon: <Bot size={20} />, label: '什么是 RAG？', description: '检索增强生成技术' },
                ]}
                wrap
              />
            )}
          </Flex>
        )}
      </Flex>
      
      <ChatInput />
    </Flex>
  );
}

function Sidebar() {
  const { state } = useApp();

  return (
    <Flex vertical gap={16}>
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-md">
        <Flex align="center" gap={12} className="mb-4">
          <Avatar icon={<FileText />} style={{ backgroundColor: '#e6f4ff', color: '#1677ff' }} size={36} />
          <h2 className="font-semibold text-gray-800 m-0">文档管理</h2>
        </Flex>
        <FileUploader />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-md">
        <Flex align="center" gap={12} className="mb-4">
          <Avatar icon={<Settings />} style={{ backgroundColor: '#f9f0ff', color: '#722ed1' }} size={36} />
          <h2 className="font-semibold text-gray-800 m-0">配置</h2>
        </Flex>
        <ConfigPanel />
      </div>

      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <Flex align="start" gap={12}>
            <Avatar icon={<AlertCircle />} style={{ backgroundColor: '#fff2f0', color: '#ff4d4f' }} size={32} />
            <div>
              <p className="font-medium text-red-800 text-sm m-0">错误</p>
              <p className="text-red-600 text-sm mt-1 m-0">{state.error}</p>
            </div>
          </Flex>
        </div>
      )}
    </Flex>
  );
}

function AppContent() {
  return (
    <Flex style={{ height: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)' }} className="p-6">
      <Flex style={{ maxWidth: 1400, width: '100%', margin: '0 auto' }} gap={24}>
        <Flex vertical style={{ width: 320 }} gap={16}>
          <Sidebar />
        </Flex>
        <Flex flex={1} style={{ minWidth: 0 }}>
          <ChatPanel />
        </Flex>
      </Flex>
    </Flex>
  );
}

function App() {
  return (
    <XProvider>
      <ConfigProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </ConfigProvider>
    </XProvider>
  );
}

export default App;
