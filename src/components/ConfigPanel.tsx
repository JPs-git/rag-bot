import { Form, Input, InputNumber, Slider, Button, Space, Popconfirm } from 'antd';
import { ReloadOutlined, ClearOutlined } from '@ant-design/icons';
import { useApp } from '@/context/AppContext';

export function ConfigPanel() {
  const { state, updateConfig, clearSession } = useApp();

  return (
    <div className="space-y-4">
      <Form layout="vertical" size="small">
        <Form.Item label="OpenAI API Key">
          <Input.Password
            placeholder="sk-..."
            value={state.config.openaiApiKey}
            onChange={(e) => updateConfig({ openaiApiKey: e.target.value })}
          />
        </Form.Item>

        <Form.Item label={`检索数量: ${state.config.retrievalConfig.topK}`}>
          <Slider
            min={1}
            max={20}
            value={state.config.retrievalConfig.topK}
            onChange={(value) =>
              updateConfig({
                retrievalConfig: { ...state.config.retrievalConfig, topK: value },
              })
            }
          />
        </Form.Item>

        <Form.Item label="Chunk 大小">
          <InputNumber
            min={100}
            max={2000}
            step={100}
            value={state.config.chunkConfig.chunkSize}
            onChange={(value) =>
              updateConfig({
                chunkConfig: { ...state.config.chunkConfig, chunkSize: value || 500 },
              })
            }
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label="Chunk 重叠">
          <InputNumber
            min={0}
            max={500}
            step={50}
            value={state.config.chunkConfig.chunkOverlap}
            onChange={(value) =>
              updateConfig({
                chunkConfig: { ...state.config.chunkConfig, chunkOverlap: value || 0 },
              })
            }
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Space direction="vertical" style={{ width: '100%' }}>
          <Popconfirm
            title="确定要重新加载配置吗？"
            onConfirm={() => {
              localStorage.removeItem('rag-bot-config');
              window.location.reload();
            }}
            okText="确定"
            cancelText="取消"
          >
            <Button icon={<ReloadOutlined />} block>
              重新加载配置
            </Button>
          </Popconfirm>

          <Popconfirm
            title="确定要清除所有数据吗？"
            onConfirm={clearSession}
            okText="确定"
            cancelText="取消"
          >
            <Button danger icon={<ClearOutlined />} block>
              清除会话
            </Button>
          </Popconfirm>
        </Space>
      </Form>
    </div>
  );
}
