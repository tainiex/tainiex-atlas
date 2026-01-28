# ⚡ 前端快速更新指南

## 🔴 Breaking Change 警告

后端 WebSocket 事件类型已更新，**必须同步修改前端代码**！

## 📦 第一步：更新依赖

```bash
npm install @tainiex/shared-atlas@0.0.34
```

## ✏️ 第二步：修改代码（3个地方）

### 修改 1: 事件类型名称

```typescript
// ❌ 旧代码
case 'chunk':

// ✅ 新代码
case 'answer_chunk':
```

### 修改 2: 字段名 data → content

```typescript
// ❌ 旧代码
appendMessage(event.data);

// ✅ 新代码
appendMessage(event.content);
```

### 修改 3: 字段名 error → message

```typescript
// ❌ 旧代码
showError(event.error);

// ✅ 新代码
showError(event.message);
```

## 📋 完整代码对比

### 修改前 ❌

```typescript
socket.on('chat:stream', (event: ChatStreamEvent) => {
  switch (event.type) {
    case 'chunk':              // ❌
      appendMessage(event.data);  // ❌
      break;
    case 'error':
      showError(event.error);    // ❌
      break;
    case 'done':
      markComplete(event.title);
      break;
  }
});
```

### 修改后 ✅

```typescript
socket.on('chat:stream', (event: ChatStreamEvent) => {
  switch (event.type) {
    case 'answer_chunk':           // ✅ 改1
      appendMessage(event.content);   // ✅ 改2
      break;
    case 'error':
      showError(event.message);      // ✅ 改3
      break;
    case 'done':
      markComplete(event.title);     // 不变
      break;
    default:
      console.log('新事件类型:', event);  // 可选：记录新事件
  }
});
```

## 🎁 额外收益（可选）

现在可以显示 AI 的思考过程和工具调用：

```typescript
socket.on('chat:stream', (event: ChatStreamEvent) => {
  switch (event.type) {
    case 'thought':               // 新增：思考过程
      showThinking(event.content);
      break;

    case 'tool_call':            // 新增：工具调用
      showToolUse(event.tool, event.args);
      break;

    case 'tool_result':          // 新增：工具结果
      hideToolUse();
      break;

    case 'answer_chunk':
      hideThinking();
      appendMessage(event.content);
      break;

    case 'error':
      showError(event.message);
      break;

    case 'done':
      markComplete(event.title);
      break;
  }
});
```

## ✅ 测试清单

- [ ] 更新依赖到 0.0.34
- [ ] 修改 `'chunk'` → `'answer_chunk'`
- [ ] 修改 `event.data` → `event.content`
- [ ] 修改 `event.error` → `event.message`
- [ ] 编译通过
- [ ] 功能测试通过

## 📚 详细文档

查看 `FRONTEND_MIGRATION_GUIDE.md` 获取完整示例和 UI 设计建议。

---

**紧急程度**: 🔴 高 - 必须更新
**预计时间**: 5-10分钟
**影响范围**: 所有 WebSocket 聊天功能
