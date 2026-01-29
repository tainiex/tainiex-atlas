import { Injectable } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class ConnectionHealthService {
    private healthScores = new Map<string, number>(); // clientId -> score (0-100)
    private latencyHistory = new Map<string, number[]>(); // Last N latencies

    // Alert threshold
    private readonly CRITICAL_SCORE = 40;

    constructor(private readonly logger: LoggerService) {
        this.logger.setContext(ConnectionHealthService.name);
    }

    /**
     * Records a latency measurement from a ping/pong exchange.
     */
    recordPong(clientId: string, latency: number) {
        // Update History
        const history = this.latencyHistory.get(clientId) || [];
        history.push(latency);
        if (history.length > 10) history.shift(); // Keep last 10
        this.latencyHistory.set(clientId, history);

        // Calculate Average Latency
        const avgLatency = history.reduce((a, b) => a + b, 0) / history.length;

        // Update Health Score
        let score = this.healthScores.get(clientId) || 100;

        // Simple Heuristic:
        // < 100ms: Excellent (+2)
        // > 500ms: Poor (-5)
        // > 1000ms: Critical (-10)

        if (avgLatency < 100) {
            score = Math.min(100, score + 2);
        } else if (avgLatency > 1000) {
            score = Math.max(0, score - 10);
        } else if (avgLatency > 500) {
            score = Math.max(0, score - 5);
        }

        this.healthScores.set(clientId, score);

        // Check for anomalies
        if (score < this.CRITICAL_SCORE) {
            this.logger.warn(
                `Client ${clientId} health critical: ${score}/100 (Avg Latency: ${avgLatency.toFixed(0)}ms)`
            );
        }
    }

    onConnect(clientId: string) {
        this.healthScores.set(clientId, 100);
        this.latencyHistory.set(clientId, []);
    }

    onDisconnect(clientId: string) {
        this.healthScores.delete(clientId);
        this.latencyHistory.delete(clientId);
    }

    getHealthScore(clientId: string): number {
        return this.healthScores.get(clientId) || 100;
    }
}
