import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { GraphEdge } from './graph-edge.entity';

export enum GraphNodeType {
  CONCEPT = 'CONCEPT',
  TECHNOLOGY = 'TECHNOLOGY',
  PROJECT = 'PROJECT',
  PERSON = 'PERSON',
  PREFERENCE = 'PREFERENCE',
}

@Entity('graph_nodes')
export class GraphNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  name: string;

  @Index()
  @Column({ type: 'enum', enum: GraphNodeType })
  type: GraphNodeType;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Index()
  @Column({ type: 'vector', width: 768, nullable: true })
  embedding: number[];

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @OneToMany(() => GraphEdge, (edge) => edge.sourceNode)
  outgoingEdges: Relation<GraphEdge>[];

  @OneToMany(() => GraphEdge, (edge) => edge.targetNode)
  incomingEdges: Relation<GraphEdge>[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
