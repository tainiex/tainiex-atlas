import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Piscina from 'piscina';
import { join } from 'path';
import { WorkerTask } from './worker.interfaces';

@Injectable()
export class WorkerPoolService implements OnModuleDestroy {
  private piscina: Piscina;

  constructor(private configService: ConfigService) {
    // Point to the main worker entry dispatcher
    const workerPath = join(__dirname, 'main.worker.js');
    this.piscina = new Piscina({
      filename: workerPath,
      maxThreads: 4,
      idleTimeout: 30000,
    });
  }

  /**
   * Run a task in the worker pool.
   * @param taskName The name of the task to route to.
   * @param data The payload for the task.
   */
  async run<T = any, R = any>(taskName: string, data: T): Promise<R> {
    const task: WorkerTask<T> = { taskName, data };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.piscina.run(task);
  }

  async onModuleDestroy() {
    await this.piscina.destroy();
  }
}
