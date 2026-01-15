import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphService } from './graph.service';
import { GraphNode } from './entities/graph-node.entity';
import { GraphEdge } from './entities/graph-edge.entity';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([GraphNode, GraphEdge])
    ],
    providers: [GraphService],
    exports: [GraphService]
})
export class GraphModule { }
