import { parentPort, workerData } from 'worker_threads';
import { GoogleAuth } from 'google-auth-library';
import { VertexAI } from '@google-cloud/vertexai';

// Simple Logger Shim
class WorkerLogger {
    info(message: string, context?: any) {
        // console.log(`[Worker Info] ${message}`, context || '');
    }
    log(message: string, context?: any) {
        // console.log(`[Worker Log] ${message}`, context || '');
    }
    error(message: string, trace?: string, context?: string) {
        console.error(`[Worker Error] ${message}`, trace || '', context || '');
    }
    warn(message: string, context?: any) {
        console.warn(`[Worker Warn] ${message}`, context || '');
    }
    debug(message: string, context?: any) { }
}

// Simple Config Shim
class WorkerConfig {
    constructor(private config: Record<string, any>) { }
    get<T>(key: string, defaultValue?: T): T {
        return (this.config[key] !== undefined ? this.config[key] : defaultValue) as T;
    }
}

async function run() {
    if (!parentPort) return;

    try {
        const { config, prompt, modelName } = workerData;
        const configService = new WorkerConfig(config);
        const logger = new WorkerLogger();

        // Initialize Auth
        const projectId = config['VERTEX_PROJECT_ID'];
        const location = config['VERTEX_LOCATION'] || 'us-central1';

        const authOptions: any = {
            scopes: 'https://www.googleapis.com/auth/cloud-platform',
            projectId: projectId,
        };
        if (config['GSA_KEY_FILE']) {
            authOptions.keyFile = config['GSA_KEY_FILE'];
        }

        const auth = new GoogleAuth(authOptions);
        const authClient = await auth.getClient();

        // Initialize Vertex AI directly (Bypassing Adapter Factory to reduce import complexity)
        // We use the same logic as GoogleVertexGaAdapter
        const vertexOptions: any = {
            project: projectId,
            location: location,
            googleAuthOptions: {
                authClient: authClient as any
            }
        };

        const vertexAI = new VertexAI(vertexOptions);
        // Use configured model or fallback to a stable model ID
        const configuredModel = config['MEMORY_DISTILLATION_MODEL'] || 'gemini-2.0-flash-001';
        const model = vertexAI.getGenerativeModel({ model: modelName || configuredModel });

        // Generate Content
        try {
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.candidates?.[0].content.parts[0].text || '';

            // Parse JSON (CPU Intensive mostly if large)
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            let memories: any[] = [];

            try {
                memories = JSON.parse(jsonStr);
                parentPort.postMessage({ result: memories });
            } catch (e) {
                console.error('[Worker] JSON Parse Error:', e);
                parentPort.postMessage({ error: 'JSON Parse Failed: ' + e.message, raw: jsonStr });
            }

        } catch (error: any) {
            console.error('[Worker] Generation Error:', error);
            parentPort.postMessage({ error: error.message });
        }

    } catch (err: any) {
        parentPort.postMessage({ error: err.message });
    }
}

run();
