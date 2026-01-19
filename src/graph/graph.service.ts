import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GraphNode, GraphNodeType } from './entities/graph-node.entity';
import { GraphEdge, GraphRelationType } from './entities/graph-edge.entity';

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(
    @InjectRepository(GraphNode)
    private nodeRepo: Repository<GraphNode>,
    @InjectRepository(GraphEdge)
    private edgeRepo: Repository<GraphEdge>,
    private dataSource: DataSource,
  ) {}

  async upsertNode(
    name: string,
    type: GraphNodeType,
    metadata: Record<string, any> = {},
    embedding?: number[],
  ): Promise<GraphNode> {
    // Simple name-based deduplication for now
    // TODO: Enhancement - Use embedding for semantic deduplication
    let node = await this.nodeRepo.findOne({ where: { name } });

    if (node) {
      // Update metadata/embedding if provided
      let changed = false;
      if (embedding) {
        node.embedding = embedding;
        changed = true;
      }
      // Merge metadata
      if (metadata) {
        node.metadata = { ...node.metadata, ...metadata };
        changed = true;
      }
      if (changed) {
        return this.nodeRepo.save(node);
      }
      return node;
    }

    node = this.nodeRepo.create({
      name,
      type,
      metadata,
      embedding,
    });
    return this.nodeRepo.save(node);
  }

  async createEdge(
    sourceNodeId: string,
    targetNodeId: string,
    relationType: GraphRelationType,
    weight: number = 1.0,
    metadata: Record<string, any> = {},
  ): Promise<GraphEdge> {
    // Idempotent edge creation
    const existing = await this.edgeRepo.findOne({
      where: {
        sourceNodeId,
        targetNodeId,
        relationType,
      },
    });

    if (existing) {
      // Update weight/metadata
      existing.weight = weight;
      existing.metadata = { ...existing.metadata, ...metadata };
      return this.edgeRepo.save(existing);
    }

    const edge = this.edgeRepo.create({
      sourceNodeId,
      targetNodeId,
      relationType,
      weight,
      metadata,
    });
    return this.edgeRepo.save(edge);
  }

  async ingestGraphData(data: { entities: string[]; relations: string[] }) {
    if (!data.entities || data.entities.length === 0) return;

    // 1. Process Nodes
    const nodeMap = new Map<string, GraphNode>();
    for (const name of data.entities) {
      // Using name as ID logic for now (normalization needed in LLM)
      const node = await this.upsertNode(name, GraphNodeType.CONCEPT);
      nodeMap.set(name, node);
    }

    // 2. Process Relationships
    // Format: "EntityA -> relation -> EntityB"
    for (const relStr of data.relations) {
      try {
        // Parse "User -> prefers -> Next.js" or "Next.js -> is_a -> Framework"
        const parts = relStr.split('->').map((s) => s.trim());
        if (parts.length !== 3) continue;

        const [sourceName, relationRaw, targetName] = parts;

        // Map relation string to Enum
        let relationType = GraphRelationType.RELATED_TO;
        const r = relationRaw.toUpperCase().replace(/ /g, '_');
        if (Object.values(GraphRelationType).includes(r as GraphRelationType)) {
          relationType = r as GraphRelationType;
        }

        // Ensure nodes exist (if not in node list, create them)
        let sourceNode = nodeMap.get(sourceName);
        if (!sourceNode) {
          sourceNode = await this.upsertNode(sourceName, GraphNodeType.CONCEPT);
          nodeMap.set(sourceName, sourceNode);
        }

        let targetNode = nodeMap.get(targetName);
        if (!targetNode) {
          targetNode = await this.upsertNode(targetName, GraphNodeType.CONCEPT);
          nodeMap.set(targetName, targetNode);
        }

        await this.createEdge(sourceNode.id, targetNode.id, relationType);
      } catch (e) {
        this.logger.warn(`Failed to process relation: ${relStr}`, e);
      }
    }
  }

  /**
   * Traverses the graph from a starting node up to N hops.
   * Uses Recursive CTE for performance.
   */
  async traverse(startNodeId: string, maxDepth: number = 2) {
    // Prevent excessive depth
    if (maxDepth > 3) maxDepth = 3;

    const query = `
        WITH RECURSIVE graph_path AS (
            -- Base Case: Direct edges from start node
            SELECT 
                e.source_node_id,
                e.target_node_id,
                e.relation_type,
                e.weight,
                1 as depth,
                ARRAY[e.source_node_id::text] as path
            FROM graph_edges e
            WHERE e.source_node_id = $1

            UNION ALL

            -- Recursive Step
            SELECT 
                e.source_node_id,
                e.target_node_id,
                e.relation_type,
                e.weight,
                gp.depth + 1,
                gp.path || e.source_node_id::text
            FROM graph_edges e
            INNER JOIN graph_path gp ON e.source_node_id = gp.target_node_id
            WHERE gp.depth < $2
            AND NOT (e.target_node_id = ANY(gp.path)) -- Cycle detection
        )
        SELECT 
            gp.*,
            target_node.name as target_node_name,
            target_node.type as target_node_type
        FROM graph_path gp
        JOIN graph_nodes target_node ON gp.target_node_id = target_node.id
        ORDER BY gp.depth, gp.weight DESC;
        `;

    const results = await this.dataSource.query(query, [startNodeId, maxDepth]);
    return results;
  }
}
