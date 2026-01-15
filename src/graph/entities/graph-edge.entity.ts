import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import type { Relation } from 'typeorm';
import { GraphNode } from './graph-node.entity';

export enum GraphRelationType {
    IS_A = 'IS_A',
    USES = 'USES',
    PREFERS = 'PREFERS',
    REJECTS = 'REJECTS',
    PART_OF = 'PART_OF',
    RELATED_TO = 'RELATED_TO'
}

@Entity('graph_edges')
@Unique(['sourceNodeId', 'targetNodeId', 'relationType'])
export class GraphEdge {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ name: 'source_node_id' })
    sourceNodeId: string;

    @ManyToOne(() => GraphNode, node => node.outgoingEdges, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'source_node_id' })
    sourceNode: Relation<GraphNode>;

    @Index()
    @Column({ name: 'target_node_id' })
    targetNodeId: string;

    @ManyToOne(() => GraphNode, node => node.incomingEdges, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'target_node_id' })
    targetNode: Relation<GraphNode>;

    @Index()
    @Column({ name: 'relation_type', type: 'enum', enum: GraphRelationType })
    relationType: GraphRelationType;

    @Column({ type: 'float', default: 1.0 })
    weight: number;

    @Column({ type: 'jsonb', default: {} })
    metadata: Record<string, any>;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
