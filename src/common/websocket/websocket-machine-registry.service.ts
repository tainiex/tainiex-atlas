import { Injectable } from '@nestjs/common';
import { createActor } from 'xstate';

import {
    WebSocketMachineActor,
    WebSocketStateMachineService,
} from './websocket-state-machine.service';
import { LoggerService } from '../logger/logger.service';

/**
 * WebSocket 状态机注册表
 * 管理所有活跃的状态机实例
 */
@Injectable()
export class WebSocketMachineRegistry {
    private readonly machines = new Map<string, WebSocketMachineActor>();

    constructor(
        private readonly machineService: WebSocketStateMachineService,
        private readonly logger: LoggerService,
    ) {
        this.logger.setContext(WebSocketMachineRegistry.name);
    }

    /**
     * 为客户端创建并启动状态机
     */
    create(clientId: string): WebSocketMachineActor {
        const machine = this.machineService.createMachine(clientId);
        const actor = createActor(machine);

        // 订阅状态变化（用于调试）
        actor.subscribe((snapshot) => {
            this.logger.debug(
                `[${clientId}] State: ${JSON.stringify(snapshot.value)} | Retry: ${snapshot.context.retryCount}`,
            );
        });

        actor.start();
        this.machines.set(clientId, actor);

        this.logger.log(`State machine created for client: ${clientId}`);
        return actor;
    }

    /**
     * 获取客户端的状态机
     */
    get(clientId: string): WebSocketMachineActor | undefined {
        return this.machines.get(clientId);
    }

    /**
     * 停止并删除状态机
     */
    remove(clientId: string): void {
        const actor = this.machines.get(clientId);
        if (actor) {
            actor.stop();
            this.machines.delete(clientId);
            this.logger.log(`State machine removed for client: ${clientId}`);
        }
    }

    /**
     * 获取所有活跃的状态机数量
     */
    getActiveCount(): number {
        return this.machines.size;
    }

    /**
     * 清理所有状态机（通常在应用关闭时调用）
     */
    cleanup(): void {
        this.logger.log(`Cleaning up ${this.machines.size} state machines`);
        this.machines.forEach((actor, clientId) => {
            actor.stop();
            this.logger.debug(`Stopped machine for client: ${clientId}`);
        });
        this.machines.clear();
    }
}
