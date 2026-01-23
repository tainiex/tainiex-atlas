# arch-design-003: Activity Tracking System / 活动追踪系统

> **Author / 作者**: AI Assistant  
> **Date / 日期**: 2026-01-24  
> **Status / 状态**: Implemented (已实现)

## Overview / 概览

The Activity Tracking System provides real-time visibility into AI agent operations. It broadcasts detailed activity events (THINKING, TOOL_EXECUTION, MEMORY_SEARCH, etc.) to connected clients via WebSocket, enabling rich UI experiences that show "what the AI is doing right now."

活动追踪系统提供 AI 智能体操作的实时可见性。它通过 WebSocket 向连接的客户端广播详细的活动事件（THINKING、TOOL_EXECUTION、MEMORY_SEARCH 等），实现丰富的 UI 体验，显示"AI 现在正在做什么"。

---

## Architecture / 架构

### High-Level Design / 高层设计

```mermaid
graph LR
    Service[ChatService/ToolsService] -->|@TrackActivity| Publisher[ActivityPublisher]
    Publisher -->|Publish Event| Gateway[ActivityGateway]
    Gateway -->|WebSocket| Client1[Client 1]
    Gateway -->|WebSocket| Client2[Client 2]
    
    style Publisher fill:#e1f5ff
    style Gateway fill:#fff4e1
```

### Components / 组件

#### 1. **ActivityPublisher** (Pub/Sub Core)

**Purpose**: Central event bus for publishing activity events.

**职责**: 发布活动事件的中央事件总线。

**Location**: `src/common/activity/activity-publisher.service.ts`

**Key Methods**:
- `publish(event: ActivityEvent): void` - Broadcast an activity event to all subscribers
- `subscribe(callback: (event) => void): () => void` - Subscribe to activity stream

#### 2. **ActivityGateway** (WebSocket Layer)

**Purpose**: WebSocket gateway that broadcasts activity events to authenticated clients.

**职责**: WebSocket 网关，向经过身份验证的客户端广播活动事件。

**Location**: `src/common/activity/activity.gateway.ts`

**Namespace**: `/api/activity`

**Authentication**: Requires valid JWT (via `@UseGuards(WsJwtGuard)`)

**Events Emitted**:
- `agent:activity` - Real-time activity updates

#### 3. **@TrackActivity Decorator** (Automatic Tracking)

**Purpose**: Decorator for automatic activity tracking on service methods.

**职责**: 服务方法的自动活动追踪装饰器。

**Location**: `src/common/activity/track-activity.decorator.ts`

**Usage Example**:

```typescript
@TrackActivity({
  type: 'TOOL_EXECUTION',
  description: 'Executing AI Tool',
})
async executeTool(name: string, args: any): Promise<any> {
  // Tool execution logic
}
```

**How it Works**:
1. Decorator wraps the method
2. Before execution: Publishes activity START event
3. After execution: Publishes activity END event with duration

**工作原理**:
1. 装饰器包装方法
2. 执行前：发布活动 START 事件
3. 执行后：发布带持续时间的活动 END 事件

---

## Activity Event Types / 活动事件类型

```typescript
enum ActivityType {
  THINKING = 'THINKING',           // LLM is reasoning
  ACTING = 'ACTING',                // Agent is taking action
  OBSERVING = 'OBSERVING',          // Processing observations
  TOOL_EXECUTION = 'TOOL_EXECUTION', // Executing a tool (weather, search, etc.)
  MEMORY_SEARCH = 'MEMORY_SEARCH',  // Searching semantic memories
  GRAPH_SEARCH = 'GRAPH_SEARCH',    // Traversing knowledge graph
}
```

**Event Structure**:

```typescript
interface ActivityEvent {
  type: ActivityType;
  description: string;
  metadata?: {
    toolName?: string;      // For TOOL_EXECUTION
    query?: string;         // For SEARCH types
    duration?: number;      // Execution time in ms
    [key: string]: any;
  };
  timestamp: Date;
  userId: string;
}
```

---

## Integration with Services / 与服务集成

### Example: ToolsService

**Before (Manual Event Publishing)**:

```typescript
async executeTool(name: string, args: any): Promise<any> {
  this.activityPublisher.publish({
    type: 'TOOL_EXECUTION',
    description: `Executing ${name}`,
    metadata: { toolName: name },
  });
  
  const result = await tool.execute(args);
  return result;
}
```

**After (Decorator-based)**:

```typescript
@TrackActivity({
  type: 'TOOL_EXECUTION',
  description: 'Executing AI Tool',
})
async executeTool(name: string, args: any): Promise<any> {
  const tool = this.toolsMap.get(name);
  return tool.execute(args);
}
```

**Benefits / 优势**:
- ✅ **DRY**: No repetitive event publishing code
- ✅ **Automatic**: Duration tracking included
- ✅ **Consistent**: Standardized event format

---

## Client Integration / 客户端集成

### WebSocket Connection

```typescript
import io from 'socket.io-client';

const activitySocket = io('wss://your-domain.com/api/activity', {
  auth: { token: yourJwtToken },
  transports: ['websocket']
});

activitySocket.on('agent:activity', (event: ActivityEvent) => {
  console.log(`[${event.type}] ${event.description}`);
  
  // Update UI with activity status
  if (event.type === 'TOOL_EXECUTION') {
    showToolExecutionBadge(event.metadata.toolName);
  }
});
```

### UI Examples / UI 示例

**Example 1: Activity Timeline**

```
10:32:45 [THINKING] Analyzing user query...
10:32:47 [TOOL_EXECUTION] Fetching weather data (2.3s)
10:32:49 [THINKING] Generating response...
10:32:50 [DONE] 
```

**Example 2: Real-time Badges**

```
🤔 Thinking...
🔧 Using tool: web_search
💾 Searching memories...
```

---

## Performance Considerations / 性能考虑

### Connection Limits / 连接限制

- No explicit limit on activity namespace connections
- Each connection consumes ~2KB memory
- Recommended: Disconnect when not actively displaying activity

### Event Throttling / 事件节流

- High-frequency events (e.g., streaming chunks) are NOT tracked
- Only coarse-grained operations are tracked (tool calls, searches)
- Typical rate: 5-10 events per user request

### Resource Impact / 资源影响

- **CPU**: Negligible (\u003c1% per event publish)
- **Memory**: ~50 bytes per event (ephemeral, not persisted)
- **Network**: ~200 bytes per event (JSON serialization)

---

## Future Enhancements / 未来增强

1. **Persistence**: Optionally store activity logs for debugging
2. **Filtering**: Client-side filtering by activity type
3. **Replay**: Time-travel debugging for past requests
4. **Analytics**: Aggregate activity metrics (tool usage, latency)

---

## References / 参考资料

- WebSocket Gateway Documentation: [NestJS WebSockets](https://docs.nestjs.com/websockets/gateways)
- Event Emitter Pattern: `@nestjs/event-emitter`
- Activity Publisher: `src/common/activity/activity-publisher.service.ts`
