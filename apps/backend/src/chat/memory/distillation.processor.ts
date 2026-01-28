/**
 * Worker thread processor with limited typing for dependencies
 */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { GoogleAuth } from 'google-auth-library';
import { VertexAI } from '@google-cloud/vertexai';
import { DataSource } from 'typeorm';
import { GraphNode } from '../../graph/entities/graph-node.entity';
import { GraphEdge } from '../../graph/entities/graph-edge.entity';
import { GraphService } from '../../graph/graph.service';
import { LoggerService } from '../../common/logger/logger.service';
import {
  DistillationPayload,
  DistillationResult,
} from '../worker/worker.interfaces';

/**
 * Pure Business Logic for Distillation.
 * Contains NO worker-thread specific code.
 * Can be run in main thread or worker thread.
 */
export async function processDistillation(
  task: DistillationPayload,
): Promise<DistillationResult> {
  let dataSource: DataSource | null = null;
  let memories: any[] = [];

  try {
    const { config, prompt, modelName } = task;

    // Initialize Auth
    const projectId = config.VERTEX_PROJECT_ID;
    const location = config.VERTEX_LOCATION || 'us-central1';

    const authOptions: any = {
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
      projectId: projectId,
    };
    if (config.GSA_KEY_FILE) {
      authOptions.keyFile = config.GSA_KEY_FILE;
    }

    const auth = new GoogleAuth(authOptions);
    const authClient = await auth.getClient();

    // Initialize Vertex AI directly

    const vertexOptions: any = {
      project: projectId,
      location: location,
      googleAuthOptions: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        authClient: authClient as any,
      },
    };

    const vertexAI = new VertexAI(vertexOptions);
    const configuredModel =
      config.MEMORY_DISTILLATION_MODEL || 'gemini-2.0-flash-001';
    const model = vertexAI.getGenerativeModel({
      model: modelName || configuredModel,
    });

    // Generate Content
    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.candidates?.[0].content.parts[0].text || '';

      // Parse JSON
      const jsonStr = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      memories = JSON.parse(jsonStr);

      // --- GRAPH INGESTION ---
      if (config.DB_HOST) {
        try {
          // Initialize TypeORM DataSource
          dataSource = new DataSource({
            type: 'postgres',
            host: config.DB_HOST,
            port: parseInt(config.DB_PORT || '5432', 10),
            username: config.DB_USERNAME,
            password: config.DB_PASSWORD,
            database: config.DB_NAME,
            ssl: config.DB_SSL === 'true',
            entities: [GraphNode, GraphEdge],
            synchronize: false,
            logging: false,
          });

          await dataSource.initialize();

          const nodeRepo = dataSource.getRepository(GraphNode);
          const edgeRepo = dataSource.getRepository(GraphEdge);
          // Create a LoggerService instance for the worker thread
          const logger = new LoggerService(null as any);
          const graphService = new GraphService(
            nodeRepo,
            edgeRepo,
            dataSource,
            logger,
          );

          // Ingest Graph Data
          for (const m of memories) {
            if (
              m.entities &&
              Array.isArray(m.entities) &&
              m.relations &&
              Array.isArray(m.relations)
            ) {
              await graphService.ingestGraphData({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                entities: m.entities,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                relations: m.relations,
              });
            }
          }
        } catch (dbError) {
          this.logger.error('[Processor] Graph Ingestion Failed:', dbError);
        }
      }

      return { result: memories };
    } catch (error: any) {
      this.logger.error('[Processor] Generation Error:', error);
      return { error: (error as Error).message };
    }
  } catch (err: any) {
    return { error: (err as Error).message };
  } finally {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}
