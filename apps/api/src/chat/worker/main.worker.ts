import { processDistillation } from '../memory/distillation.processor';
import { WorkerTask, DistillationPayload } from './worker.interfaces';

/**
 * Main Worker Entry Point
 * Routes tasks to specific handlers based on taskName.
 *
 * Logic:
 * 1. Piscina calls this function with { taskName, data }
 * 2. Switch on taskName
 * 3. Delegate to imported handler
 */
export default async function (task: WorkerTask): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { taskName, data } = task;

    switch (taskName) {
        case 'distillConversation':
            return processDistillation(data as DistillationPayload);
        default:
            throw new Error(`Unknown task: ${taskName}`);
    }
}
