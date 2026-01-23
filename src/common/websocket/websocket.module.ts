import { Module, Global } from '@nestjs/common';

import { WebSocketStateMachineService } from './websocket-state-machine.service';
import { WebSocketMachineRegistry } from './websocket-machine-registry.service';

/**
 * WebSocket 状态机模块
 * 全局模块，提供状态机服务给所有 Gateway 使用
 */
@Global()
@Module({
  providers: [WebSocketStateMachineService, WebSocketMachineRegistry],
  exports: [WebSocketStateMachineService, WebSocketMachineRegistry],
})
export class WebSocketModule {}
