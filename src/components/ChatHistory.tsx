import { Bubble, Sources } from '@ant-design/x';
import { Avatar } from 'antd';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import type { Message } from '@/types';

const roles = {
  assistant: {
    placement: 'start' as const,
    avatar: <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1677ff' }} />,
  },
  user: {
    placement: 'end' as const,
    avatar: <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#52c41a' }} />,
  },
};

interface ChatHistoryProps {
  messages: Message[];
}

export function ChatHistory({ messages }: ChatHistoryProps) {
  if (messages.length === 0) {
    return null;
  }

  const items = messages.map((msg) => ({
    key: msg.id,
    role: msg.role,
    content: msg.content,
    loading: false,
    footer: msg.role === 'assistant' && msg.sources && msg.sources.length > 0 ? (
      <Sources
        title="引用来源"
        items={msg.sources.map((source, index) => ({
          key: String(index),
          title: `文档片段 ${index + 1}`,
          description: source.chunk.content.slice(0, 100) + (source.chunk.content.length > 100 ? '...' : ''),
        }))}
        defaultExpanded={false}
      />
    ) : undefined,
  }));

  return (
    <Bubble.List
      style={{ padding: 16 }}
      items={items}
      role={roles}
      autoScroll
    />
  );
}
