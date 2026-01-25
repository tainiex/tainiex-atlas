
import { AgentContext } from './agent-context.interface';

export interface IToolProvider {
    /** Tool unique name / 工具唯一名称 */
    name: string;

    /** Tool description / 工具描述 */
    description: string;

    /** Parameter Schema (JSON Schema) / 参数 Schema */
    parameters: Record<string, any>;

    /** Execute tool / 执行工具 */
    execute(parameters: any, context?: AgentContext): Promise<any>;
}
