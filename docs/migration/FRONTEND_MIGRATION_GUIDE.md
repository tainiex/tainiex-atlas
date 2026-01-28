# Frontend Migration Guide: ChatStreamEvent 类型更新

## 📢 重要通知

后端已更新 `ChatStreamEvent` 类型，从简单的 interface 升级为**可辨识联合类型**（discriminated union），现在可以区分思考过程、工具调用和答案内容。

**版本**: shared-atlas@0.0.34
**Breaking Change**: 是
**紧急程度**: 高（需要同步更新前端代码）

---

## 🔄 类型变化对比

### 旧类型（已废弃）

```typescript
interface ChatStreamEvent {
  type: 'chunk' | 'done' | 'error';
  data?: string;      // 文本内容
  error?: string;     // 错误信息
  title?: string;     // 会话标题
}
```

### 新类型（当前版本）

```typescript
type ChatStreamEvent =
  // 思考过程（新增）
  | { type: 'thought'; content: string }

  // 工具调用（新增）
  | { type: 'tool_call'; tool: string; args: any }

  // 工具结果（新增）
  | { type: 'tool_result'; tool: string; result: any }

  // 答案片段（重命名 + 字段改名）
  | { type: 'answer_chunk'; content: string }  // 原 'chunk' + 'data'

  // 完成标记（保持不变）
  | { type: 'done'; title?: string }

  // 错误事件（字段改名）
  | { type: 'error'; message: string }  // 原 'error' 字段
```

---

## ⚠️ Breaking Changes 详细说明

| 变化类型 | 旧版本 | 新版本 | 影响 |
|---------|--------|--------|------|
| 事件类型重命名 | `type: 'chunk'` | `type: 'answer_chunk'` | **必须修改** |
| 字段名变更 | `data?: string` | `content: string` | **必须修改** |
| 字段名变更 | `error?: string` | `message: string` | **必须修改** |
| 新增事件类型 | - | `'thought'` | 可选处理 |
| 新增事件类型 | - | `'tool_call'` | 可选处理 |
| 新增事件类型 | - | `'tool_result'` | 可选处理 |

---

## 🚀 迁移步骤

### Step 1: 更新依赖

```bash
# 更新 shared-atlas 包到最新版本
npm install @tainiex/shared-atlas@0.0.34
# 或
pnpm install @tainiex/shared-atlas@0.0.34
# 或
yarn add @tainiex/shared-atlas@0.0.34
```

### Step 2: 最小改动迁移（快速修复）

如果暂时不需要显示思考过程和工具调用，只需修改现有代码：

**修改前**:
```typescript
socket.on('chat:stream', (event: ChatStreamEvent) => {
  switch (event.type) {
    case 'chunk':  // ❌ 旧的事件类型
      appendMessage(event.data);  // ❌ 旧的字段名
      break;
    case 'error':
      showError(event.error);  // ❌ 旧的字段名
      break;
    case 'done':
      markComplete(event.title);
      break;
  }
});
```

**修改后**:
```typescript
socket.on('chat:stream', (event: ChatStreamEvent) => {
  switch (event.type) {
    case 'answer_chunk':  // ✅ 新的事件类型
      appendMessage(event.content);  // ✅ 新的字段名
      break;
    case 'error':
      showError(event.message);  // ✅ 新的字段名
      break;
    case 'done':
      markComplete(event.title);
      break;
    default:
      // 忽略新增的事件类型（thought, tool_call, tool_result）
      console.log('Unhandled event:', event);
  }
});
```

### Step 3: 完整功能迁移（推荐）

利用新的事件类型提升用户体验：

```typescript
socket.on('chat:stream', (event: ChatStreamEvent) => {
  switch (event.type) {
    case 'thought':
      // 显示 AI 思考过程
      showThinkingIndicator(event.content);
      // 例如: "正在思考: 我需要搜索最新的天气数据..."
      break;

    case 'tool_call':
      // 显示工具调用状态
      showToolCallBadge(event.tool, event.args);
      // 例如: "🔧 调用工具: search (query: '北京天气')"
      break;

    case 'tool_result':
      // 显示工具执行结果（可选）
      showToolResult(event.tool, event.result);
      // 例如: "✅ 搜索完成，找到 5 条结果"
      break;

    case 'answer_chunk':
      // 流式显示答案
      appendMessage(event.content);
      hideThinkingIndicator();  // 隐藏思考提示
      break;

    case 'done':
      // 标记完成，更新标题
      markComplete();
      if (event.title) {
        updateSessionTitle(event.title);
      }
      break;

    case 'error':
      // 显示错误
      showError(event.message);
      hideThinkingIndicator();
      break;
  }
});
```

---

## 💡 UI/UX 建议

### 1. 思考过程显示 (thought)

```tsx
// React 示例
function ThinkingIndicator({ content }: { content: string }) {
  return (
    <div className="thinking-bubble">
      <span className="thinking-icon">🤔</span>
      <span className="thinking-text">{content}</span>
    </div>
  );
}
```

**效果**:
```
🤔 正在分析问题...
🤔 需要搜索相关信息...
🤔 整理答案中...
```

### 2. 工具调用显示 (tool_call)

```tsx
// React 示例
function ToolCallBadge({ tool, args }: { tool: string; args: any }) {
  const toolIcons = {
    search: '🔍',
    weather: '🌤️',
    calculator: '🔢',
    default: '🔧'
  };

  return (
    <div className="tool-badge">
      <span>{toolIcons[tool] || toolIcons.default}</span>
      <span>使用 {tool}</span>
      <small>{JSON.stringify(args)}</small>
    </div>
  );
}
```

**效果**:
```
🔍 使用 search {"query": "TypeScript 教程"}
🌤️ 使用 weather {"city": "北京"}
```

### 3. 工具结果显示 (tool_result)

```tsx
// React 示例
function ToolResultIndicator({ tool, result }: { tool: string; result: any }) {
  return (
    <div className="tool-result">
      <span className="success-icon">✅</span>
      <span>{tool} 执行完成</span>
      {/* 可选：显示结果摘要 */}
    </div>
  );
}
```

---

## 🔍 TypeScript 类型检查

新类型是可辨识联合类型，TypeScript 会自动进行类型收窄：

```typescript
function handleEvent(event: ChatStreamEvent) {
  if (event.type === 'thought') {
    // TypeScript 知道这里 event.content 一定存在
    console.log(event.content);  // ✅ 类型安全
    // console.log(event.tool);  // ❌ 编译错误：'tool' 不存在
  }

  if (event.type === 'tool_call') {
    // TypeScript 知道这里 event.tool 和 event.args 存在
    console.log(event.tool, event.args);  // ✅ 类型安全
  }

  if (event.type === 'answer_chunk') {
    // TypeScript 知道这里 event.content 存在
    console.log(event.content);  // ✅ 类型安全
  }
}
```

---

## 🧪 测试检查清单

迁移完成后，请测试以下场景：

- [ ] 正常消息发送和接收（answer_chunk 事件）
- [ ] 错误处理（error 事件，检查 `message` 字段）
- [ ] 会话完成（done 事件，标题更新）
- [ ] 思考过程显示（thought 事件，如果实现）
- [ ] 工具调用显示（tool_call 事件，如果实现）
- [ ] 工具结果显示（tool_result 事件，如果实现）
- [ ] TypeScript 类型检查无错误
- [ ] 旧版本客户端兼容性（如有需要）

---

## 📝 完整示例代码

### React + TypeScript 完整示例

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChatStreamEvent } from '@tainiex/shared-atlas';

export function ChatComponent() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [thinking, setThinking] = useState<string | null>(null);
  const [toolCall, setToolCall] = useState<{ tool: string; args: any } | null>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3000');

    newSocket.on('chat:stream', (event: ChatStreamEvent) => {
      switch (event.type) {
        case 'thought':
          setThinking(event.content);
          break;

        case 'tool_call':
          setToolCall({ tool: event.tool, args: event.args });
          break;

        case 'tool_result':
          // 工具完成，清除工具调用显示
          setToolCall(null);
          break;

        case 'answer_chunk':
          setThinking(null);  // 清除思考提示
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0) {
              updated[lastIdx] += event.content;
            } else {
              updated.push(event.content);
            }
            return updated;
          });
          break;

        case 'done':
          setThinking(null);
          setToolCall(null);
          console.log('Session complete', event.title);
          break;

        case 'error':
          setThinking(null);
          setToolCall(null);
          alert(`错误: ${event.message}`);
          break;
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <div className="chat-container">
      {/* 思考提示 */}
      {thinking && (
        <div className="thinking-indicator">
          🤔 {thinking}
        </div>
      )}

      {/* 工具调用提示 */}
      {toolCall && (
        <div className="tool-indicator">
          🔧 使用 {toolCall.tool}: {JSON.stringify(toolCall.args)}
        </div>
      )}

      {/* 消息列表 */}
      {messages.map((msg, idx) => (
        <div key={idx} className="message">{msg}</div>
      ))}
    </div>
  );
}
```

### Vue 3 + TypeScript 示例

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';
import type { ChatStreamEvent } from '@tainiex/shared-atlas';

const socket = ref<Socket | null>(null);
const messages = ref<string[]>([]);
const thinking = ref<string | null>(null);
const toolCall = ref<{ tool: string; args: any } | null>(null);

onMounted(() => {
  socket.value = io('http://localhost:3000');

  socket.value.on('chat:stream', (event: ChatStreamEvent) => {
    switch (event.type) {
      case 'thought':
        thinking.value = event.content;
        break;

      case 'tool_call':
        toolCall.value = { tool: event.tool, args: event.args };
        break;

      case 'tool_result':
        toolCall.value = null;
        break;

      case 'answer_chunk':
        thinking.value = null;
        const lastIdx = messages.value.length - 1;
        if (lastIdx >= 0) {
          messages.value[lastIdx] += event.content;
        } else {
          messages.value.push(event.content);
        }
        break;

      case 'done':
        thinking.value = null;
        toolCall.value = null;
        break;

      case 'error':
        thinking.value = null;
        toolCall.value = null;
        alert(`错误: ${event.message}`);
        break;
    }
  });
});

onUnmounted(() => {
  socket.value?.close();
});
</script>

<template>
  <div class="chat-container">
    <div v-if="thinking" class="thinking-indicator">
      🤔 {{ thinking }}
    </div>

    <div v-if="toolCall" class="tool-indicator">
      🔧 使用 {{ toolCall.tool }}: {{ JSON.stringify(toolCall.args) }}
    </div>

    <div v-for="(msg, idx) in messages" :key="idx" class="message">
      {{ msg }}
    </div>
  </div>
</template>
```

---

## 🐛 常见问题

### Q1: 为什么我的代码编译失败？

**A**: 检查以下几点：
1. 是否更新了 `@tainiex/shared-atlas` 到最新版本？
2. 是否将 `'chunk'` 改为 `'answer_chunk'`？
3. 是否将 `event.data` 改为 `event.content`？
4. 是否将 `event.error` 改为 `event.message`？

### Q2: 我可以忽略新增的事件类型吗？

**A**: 可以。如果暂时不需要显示思考过程和工具调用，可以在 `default` 分支中忽略它们。但建议至少记录日志以便调试：

```typescript
default:
  console.log('Unhandled event type:', event.type, event);
```

### Q3: 旧版本客户端会怎样？

**A**: 旧版本客户端会报错，因为：
- 它们监听 `'chunk'` 事件，但新后端发送 `'answer_chunk'`
- 它们访问 `event.data`，但新后端使用 `event.content`

**必须同步更新所有客户端**。

### Q4: 如何测试新事件类型？

**A**: 发送一个需要工具调用的问题，例如：
```typescript
socket.emit('chat:send', {
  sessionId: 'xxx',
  content: '北京今天天气怎么样？',  // 会触发 weather 工具
});
```

你应该能看到以下事件序列：
1. `thought` - "我需要查询北京的天气..."
2. `tool_call` - `{ tool: 'weather', args: { city: '北京' } }`
3. `tool_result` - `{ tool: 'weather', result: {...} }`
4. `answer_chunk` - "北京今天..."（答案片段）
5. `done` - 完成

---

## 📞 需要帮助？

如有问题，请联系后端团队或查看：
- 后端实现 PR: [链接]
- 类型定义: `shared-atlas/src/interfaces/chat.interface.ts`
- 类型兼容性测试: `src/agent-core/__tests__/event-compatibility.spec.ts`

---

**最后更新**: 2026-01-28
**更新人**: Backend Team + Claude Sonnet 4.5
