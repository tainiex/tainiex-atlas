# Tainiex Atlas

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-latest-336791?logo=postgresql)](https://www.postgresql.org/)

A modern, production-ready backend API built with NestJS that provides authentication, user management, and AI-powered chat capabilities using Google Vertex AI. Perfect as a starter template for building scalable applications with enterprise-grade features.

## Product Positioning / 产品定位

Tainiex Atlas is a **modern, enterprise-grade backend solution** designed to be the robust foundation for AI-native applications. It seamlessly integrates:
- **Secure Authentication**: Traditional JWT + Google OAuth + Role-based Access.
- **Real-time Collaboration**: Multi-user editing (CRDT/Y.js) and presence systems.
- **AI Intelligence**: Native integration with Google Vertex AI (Gemini) for chat and RAG (Retrieval-Augmented Generation).

It is not just a boilerplate; it is a **production-ready architecture** that solves complex problems like WebSocket state management, distributed rate limiting, and long-term memory distillation out of the box.

## Design Philosophy / 设计思想

1.  **Modular Architecture (模块化)**:
    -   Each major feature (Auth, Chat, Notes) is a self-contained module.
    -   Clear separation of concerns between Controllers (HTTP), Gateways (WebSocket), and Services (Logic).

2.  **RESTful & Real-time Hybrid**:
    -   Uses standard **RESTful APIs** for resource management (CRUD).
    -   Uses **WebSocket (Socket.io)** for high-frequency interactive features (Chat Streaming, Collaboration).

3.  **Strict Type Safety**:
    -   End-to-end type safety from Backend to Frontend using shared DTOs (`@tainiex/shared-atlas`).
    -   No "magic strings" or `any` types allowed in core logic.

4.  **Performance First**:
    -   **Heavy Lifting Offloaded**: Graph processing and embedding generation run in a dedicated **Worker Pool**.
    -   **Efficient Storage**: Uses Partial Indexes for tree structures and binary storage for CRDTs.

5.  **Security by Design**:
    -   Global Validation Pipes, Rate Limiting, and CSP.
    -   Environment-isolated configurations.

### Key Features

- **Long-Term Memory**: AI remembers user preferences and project details via Vector RAG (Memory Distillation).
- **Knowledge Graph**: Personalized Knowledge Graph (Graph RAG) running on PostgreSQL to capture entity relationships.
- **Performance**: Heavy AI/Graph processing offloaded to **Generic Worker Pool** (powered by Piscina) to ensure zero-latency API responses.
- **Notion-like Notes**: Block-based editor support with multimodal content (Markdown, Tables, Code, Media)
- **Real-time Collaboration**: Multi-user editing powered by Y.js CRDT with cursor synchronization
- **Smart Versioning**: Intelligent note snapshots and block-level history with diff tracking
- **Secure File Storage**: Multimedia support via Google Cloud Storage with size-restricted uploads
- **Type Safety**: Full TypeScript implementation with shared type definitions
- **Production Ready**: Enterprise-grade architecture with security best practices
- **Performance Optimized**: Uses partial indexes and lazy loading for efficient tree structure handling


## Tech Stack

- **Framework**: NestJS 11.0.1
- **Language**: TypeScript 5.7.3
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT + Passport.js + Google OAuth 2.0
- **AI/ML**: Google Vertex AI (Gemini) / Mistral AI
- **Collaboration**: Y.js (CRDT) + Socket.io
- **Storage**: Google Cloud Storage
- **Testing**: Jest
- **Code Quality**: ESLint + Prettier

## Prerequisites

Before you begin, ensure you have the following installed and configured:

- **Node.js**: v18 or higher
- **npm** or **yarn**: Latest version
- **PostgreSQL**: v12 or higher
- **Google Cloud Platform Account** with:
  - Cloud Storage API enabled
  - Vertex AI API enabled
  - OAuth 2.0 credentials configured
  - Service Account with appropriate permissions

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/tainiex/tainiex-atlas.git
cd tainiex-atlas
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
API_PREFIX=api
LOG_LEVEL=info # debug | info | warn | error (Controls custom LoggerService; NestJS built-in logger controlled by NODE_ENV)
CORS_ORIGIN=https://your-frontend.com,https://admin.your-domain.com # Comma-separated allowed origins (default: * in dev, none in prod)


# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-database-password
DB_NAME=tainiex_core
DB_SSL=false # Set to true to enable SSL connection (default: true in production, false otherwise)

# JWT Configuration
JWT_SECRET=your-jwt-secret-key-here
JWT_REFRESH_SECRET=your-jwt-refresh-secret-key-here

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-frontend-domain.com/app # Optional: Leave empty or remove for Popup UX (defaults to 'postmessage')

# Google Cloud Storage Configuration
GCS_BUCKET_NAME=your-gcs-bucket-name
GSA_KEY_FILE=./path/to/service-account-key.json

# Vertex AI Configuration
VERTEX_PROJECT_ID=your-gcp-project-id
VERTEX_LOCATION=us-central1
VERTEX_MODEL=gemini-pro

# Mistral AI Configuration
MISTRAL_API_KEY=your_mistral_api_key_here
```

### 4. Set Up PostgreSQL Database

Create a PostgreSQL database:

```bash
createdb tainiex_core
```

The application will automatically synchronize the database schema on first run (development mode only).

#### Enable Required PostgreSQL Extensions

Tainiex Atlas requires the following PostgreSQL extensions:

- **`tsvector`**: Built-in PostgreSQL full-text search capability (included in PostgreSQL by default, no installation needed)
- **`pgvector`**: Vector similarity search for AI embeddings and semantic search

**For Self-Hosted PostgreSQL:**

Connect to your database and run:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
```

If `pgvector` is not available, install it first:

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-16-pgvector

# macOS (Homebrew)
brew install pgvector

# From source (if needed)
git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

**For Google Cloud SQL (PostgreSQL):**

1. Navigate to your Cloud SQL instance in Google Cloud Console
2. Go to **Databases** tab
3. Connect to your database using Cloud Shell or any SQL client
4. Run the following SQL:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
```

> **Note**: Cloud SQL for PostgreSQL includes `pgvector` by default in PostgreSQL 15+. For earlier versions, you may need to upgrade your instance or contact Google Cloud support.

> **Note for Chinese Users / 中文用户注意**: 
> `tsvector` 是 PostgreSQL 内置的全文搜索功能，无需额外安装。`pgvector` 扩展用于向量数据库功能，支持AI语义搜索和embedding存储。

### 5. Configure Google Cloud Platform

#### Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **IAM & Admin** > **Service Accounts**
3. Create a new service account with the following roles:
   - Storage Object Admin
   - Vertex AI User
4. Download the JSON key file and save it to your project directory
5. Update `GSA_KEY_FILE` in your `.env` file

#### Set Up OAuth 2.0

1. Go to **APIs & Services** > **Credentials**
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URIs
4. Copy Client ID and Client Secret to your `.env` file

#### Create Cloud Storage Bucket

1. Navigate to **Cloud Storage** > **Buckets**
2. Create a new bucket for avatar storage
3. Update `GCS_BUCKET_NAME` in your `.env` file

#### Enable Required APIs

- Cloud Storage API
- Vertex AI API
- Cloud Resource Manager API

## Deployment
 
Tainiex Atlas is configured for automated deployment to **Google Cloud Run** using GitHub Actions.
 
### Continuous Deployment Pipeline
 
The pipeline is defined in `.github/workflows/deploy-cloudrun-prod.yml` and triggers on every push to the `main` branch. It performs the following steps:
 
1.  **Checkout Code**: Retrieves the latest code from the repository.
2.  **Authenticate to Google Cloud**: Uses the Service Account Key.
3.  **Setup Node.js**: Configuring the environment.
4.  **Install & Build**: Installs dependencies and builds the NestJS application.
5.  **Build & Push Docker Image**: Builds the container image and pushes it to GitHub Container Registry (ghcr.io).
6.  **Deploy to Cloud Run**: Deploys the new image to Google Cloud Run with the configured environment variables.
 
### Required GitHub Secrets
 
To enable the deployment pipeline, you must configure the following **Secrets** in your GitHub repository settings:
 
| Secret Name | Description |
|-------------|-------------|
| `GCP_PROJECT_ID` | Your Google Cloud Project ID |
| `GCP_SA_KEY` | The JSON key content of your Google Service Account |
| `CLOUD_RUN_GCP_SERVICE_ACCOUNT` | The email address of the implementation service account |
| `DB_HOST` | Production database host (e.g., Cloud SQL IP) |
| `DB_PORT` | Production database port (default: 5432) |
| `DB_USERNAME` | Production database username |
| `DB_PASSWORD` | Production database password |
| `DB_NAME` | Production database name |
| `JWT_SECRET` | Secret key for signing Access Tokens |
| `JWT_REFRESH_SECRET` | Secret key for signing Refresh Tokens |

### Service Account Permissions

To ensure smooth deployment and operation, ensure your Google Cloud Service Accounts have the following IAM roles:

#### 1. GitHub Actions Deployment Account (CI/CD)
This account is used by the GitHub workflow (`GCP_SA_KEY`) to build and deploy the application.
-   **Cloud Run Admin** (`roles/run.admin`): Required to deploy new revisions to Cloud Run.
-   **Storage Admin** (`roles/storage.admin`) or **Artifact Registry Writer** (`roles/artifactregistry.writer`): Required to push container images to Google Container Registry (GCR) or Artifact Registry.
-   **Artifact Registry Create-on-Push Writer** (`roles/artifactregistry.createOnPushWriter`): Required if you want the push to automatically create the repository (optional but recommended).
-   **Service Account User** (`roles/iam.serviceAccountUser`): Required to act as the runtime service account during deployment.

#### 2. Application Runtime Account
This account (`CLOUD_RUN_GCP_SERVICE_ACCOUNT`) is the identity under which your Cloud Run service runs.
-   **Vertex AI User** (`roles/aiplatform.user`): Required to access Gemini models on Vertex AI.
-   **Storage Object Admin** (`roles/storage.objectAdmin`): Required to manage user avatars in the configured Cloud Storage bucket.
-   **Service Account Token Creator** (`roles/iam.serviceAccountTokenCreator`): **Required** to generate V4 Signed URLs for GCS private files. The runtime service account needs this role to sign requests on its own behalf.
 
## Running the Application

### Development Mode

Run with auto-reload on file changes:

```bash
npm run start:dev
# or
yarn start:dev
```

The API will be available at `http://localhost:3000/api`

### Production Mode

Build and run the production version:

```bash
npm run build
npm run start:prod
# or
yarn build
yarn start:prod
```

### Testing

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate test coverage report
npm run test:cov

# Run end-to-end tests
npm run test:e2e
```

### Code Quality

```bash
# Lint and auto-fix code
npm run lint

# Format code with Prettier
npm run format
```

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/auth/signup` | No | Register a new user account |
| POST | `/auth/login` | No | Login with username and password |
| POST | `/auth/google` | No | Authenticate with Google OAuth 2.0 |
| POST | `/auth/refresh` | Refresh Token | Refresh access token |
| GET | `/auth/profile` | JWT | Get current authenticated user profile |
| POST | `/auth/logout` | JWT | Logout and invalidate tokens |

### User Management (`/api/profile`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/profile` | JWT | Get user profile with signed avatar URL |

### AI Chat (`/api/chat`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/chat/sessions` | JWT | Get user chat sessions |
| POST | `/chat/sessions` | JWT | Create a new chat session |
| GET | `/chat/sessions/:id` | JWT | Get single session details |
| DELETE | `/chat/sessions/:id` | JWT | Delete a session (Soft Delete) |
| PATCH | `/chat/sessions/:id` | JWT | Update session title |
| GET | `/chat/sessions/:id/messages` | JWT | Get messages for a session |
| GET | `/chat/models` | JWT | List supported AI models |

### Notes System (`/api/notes` & `/api/blocks`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/notes` | JWT | List user notes (returns root notes by default; use `?parentId=ID` for children) |
| POST | `/notes` | JWT | Create a new note (optional template) |
| GET | `/notes/:id` | JWT | Get note metadata and blocks |
| PATCH | `/notes/:id` | JWT | Update note title, cover, or icon |
| DELETE | `/notes/:id` | JWT | Soft delete a note |
| POST | `/notes/:id/duplicate` | JWT | Duplicate a note and its blocks |
| POST | `/notes/:id/blocks` | JWT | Create a new block in a note |
| PATCH | `/blocks/:id` | JWT | Update block content or metadata |
| DELETE | `/blocks/:id` | JWT | Delete a block |
| POST | `/blocks/:id/move` | JWT | Reorder or move block to another parent |

### Media Upload (`/api/upload`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/upload/image/:noteId` | JWT | Upload image (max 10MB) |
| POST | `/upload/video/:noteId` | JWT | Upload video (max 100MB) |
| POST | `/upload/file/:noteId` | JWT | Upload attachment (max 50MB) |

### WebSocket Gateways

**1. AI Chat Room (`wss://domain.com/api/chat`)**
... (existing content) ...

**2. Collaboration Room (`wss://domain.com/api/collaboration`)**

| Event | Direction | Description |
|-------|-----------|-------------|
| `note:join` | Client→Server | Join a note session (Payload: `{noteId}`) |
| `yjs:sync` | Server→Client | Initial document state synchronization |
| `yjs:update` | Bi-directional | Stream base64 encoded CRDT updates |
| `cursor:update` | Bi-directional | Real-time cursor and selection sync |
| `presence:list` | Server→Client | Get list of current active collaborators |
| `collaboration:limit` | Server→Client | Triggered if > 5 users try to edit |

**Frontend Integration Flow (Critical):**
1.  **Connect**: Establish WebSocket connection with JWT.
2.  **Join Note**: MUST emit `note:join` with `{ noteId }` immediately. The server does NOT send data until this event is received.
3.  **Receive Data**: Listen for `yjs:sync`. This event contains the initial document state (blocks).
    *   **Payload**: `{ noteId, update: "base64...", stateVector: "base64..." }`
    *   **Action**: Decode base64 to Uint8Array and apply to Y.js doc.
4.  **Edit**: Bind Tiptap to `blocks` key (or `default` fallback). Y.js handles sync automatically.

### WebSocket (`wss://domain.com/api/chat`)

**Real-time Chat Streaming** - High-performance bi-directional streaming for AI responses.

| Event | Direction | Auth Required | Description |
|-------|-----------|---------------|-------------|
| `connect` | Client→Server | Yes | Establish connection (Supports JWT `auth` or HttpOnly cookies) |
| `chat:send` | Client→Server | Yes | Send message (Payload: `{sessionId, content, model?, role?}`) |
| `chat:stream` | Server→Client | - | Stream events: `chunk`, `done`, `error` / 流事件：`chunk`, `done`, `error` |
| `auth:token-expiring` | Server→Client | - | Warns client 5min before expiry (refresh required) / 过期前5分钟警告（需刷新） |
| `auth:token-refreshed` | Client→Server | Yes | Notify server of token renewal (Payload: `{ newToken }`) / 通知服务器令牌已更新 |
| `message:ack` | Client→Server | - | Acknowledge critical message (Payload: `{ messageId }`) / 确认关键消息 |

**Connection Configuration**:
> **Note / 注意**: To prevent abuse, connections are rate-limited to 50 requests per minute per IP address. Excessive violations trigger a 1-hour IP block.
> 限制每 IP 每分钟 50 次请求。过度违规将触发 1 小时 IP 封锁。
> **Mobile Stability / 移动端稳定性**: If users experience frequent disconnects on mobile, ensure the client uses `transports: ['websocket']` to bypass proxy buffering. The server is tuned with longer `pingTimeout` (20s) to tolerate network jitters.
> 移动端若频繁断连，请确保客户端使用 `transports: ['websocket']` 以绕过代理缓冲。服务器已调整 `pingTimeout` (20s) 以容忍网络抖动。
> **Reliability / 可靠性**: Critical server messages (like stream start/end) include a `messageId`. Clients MUST acknowledge receipt via `message:ack` to prevent duplicate delivery upon reconnection.
> 关键服务器消息包含 `messageId`。客户端必须通过 `message:ack` 确认接收，以防止重连时重复投递。

For the best experience and to bypass potential proxy buffering issues, we recommend forcing the `websocket` transport:

```typescript
import io from 'socket.io-client';

const socket = io('wss://your-domain.com/api/chat', {
  auth: { token: yourJwtToken }, // Optional if using cookies
  withCredentials: true,         // Required for httpOnly cookies
  transports: ['websocket']      // Highly recommended
});

socket.on('chat:stream', (event) => {
  if (event.type === 'chunk') processChunk(event.data);
  else if (event.type === 'done') finalize();
});

socket.emit('chat:send', { sessionId: 'xxx', content: 'Hello' });
```

> 📱 **Mobile Development** / **移动端开发**:
> For a detailed guide on handling mobile connection stability (reconnects, visibility changes), please see [Mobile WebSocket Guide](docs/mobile_websocket_guide.md).
> 
> 关于处理移动端连接稳定性（重连、页面可见性变化）的详细指南，请参阅 [移动端 WebSocket 指南](docs/mobile_websocket_guide.md)。


## Project Structure

```
tainiex-atlas/
├── src/
│   ├── auth/              # Authentication module
│   │   ├── strategies/    # Passport strategies (JWT, Google OAuth)
│   │   ├── guards/        # Auth guards
│   │   └── auth.service.ts
│   ├── users/             # User management module
│   │   ├── users.service.ts
│   │   └── user.entity.ts
│   ├── chat/              # AI chat system
│   │   ├── chat.gateway.ts      # WebSocket handler
│   │   ├── chat.service.ts      # Session & message logic
│   │   ├── memory/              # Memory distillation & RAG
│   │   ├── queue/               # Async job processing
│   │   └── worker/              # Worker pool for heavy tasks
│   ├── notes/             # Notion-like notes system
│   │   ├── collaboration.gateway.ts  # Y.js real-time sync
│   │   ├── notes.service.ts
│   │   ├── blocks.service.ts    # Block-based content
│   │   ├── yjs-transformer.service.ts
│   │   └── entities/            # Note, Block, Snapshot, etc.
│   ├── llm/               # AI integration layer
│   │   ├── llm.service.ts       # Vertex AI wrapper
│   │   └── adapters/            # Model adapters (Gemini, Mistral)
│   ├── tools/             # Agentic AI tools
│   │   ├── tools.service.ts
│   │   └── providers/           # Weather, Search, Wikipedia, Stock
│   ├── graph/             # Knowledge graph (Graph RAG)
│   │   ├── graph.service.ts
│   │   └── entities/            # GraphNode, GraphEdge
│   ├── invitation/        # Invitation code system
│   ├── rate-limit/        # Distributed rate limiting
│   ├── health/            # Health check endpoints
│   ├── common/            # Shared utilities
│   │   ├── activity/      # Real-time activity tracking
│   │   ├── logger/        # Winston-based logging
│   │   ├── storage/       # Google Cloud Storage
│   │   ├── websocket/     # WebSocket utilities & state machine
│   │   └── context/       # CLS for request context
│   ├── app.module.ts      # Root application module
│   └── main.ts            # Application entry point
├── docs/                  # Architecture design documents
│   └── arch-design-XXX-*.md  # Numbered design docs
├── shared-atlas/          # Shared TypeScript library
│   ├── src/
│   │   ├── dto/           # Request/Response DTOs
│   │   └── interfaces/    # Core type definitions
│   └── script/            # Code generation (Dart, Rust)
├── test/                  # Test files
├── gsa/                   # Google Service Account keys (gitignored)
├── .env                   # Environment variables (gitignored)
└── package.json
```

## Features in Detail

### Authentication System

**Traditional Authentication**
- Bcrypt password hashing with 10 salt rounds
- Secure credential validation
- User registration with validation

**Google OAuth 2.0**
- Seamless Google Sign-In integration
- Automatic user profile creation
- Avatar import from Google profile picture

**JWT Token Management**
- Access tokens (15 minutes expiration)
- Refresh tokens (7 days expiration)
- HttpOnly, secure cookies for token storage
- Automatic token refresh mechanism

### Avatar Management

- **Private Storage**: Avatars stored securely on Google Cloud Storage
- **Signed URLs**: Time-limited access URLs (15 minutes)
- **Auto-Import**: Automatic download from Google OAuth profile pictures
- **Secure Access**: Private bucket configuration with on-demand signed URL generation

### AI Chat Capabilities

- **Google Vertex AI Integration**: Powered by the Gemini language model
- **Mistral AI Support**: Alternative LLM provider with configurable models
- **Conversation History**: Support for multi-turn conversations with linked-list message tracking (`parent_id`)
- **Message Versioning**: Automatic archiving of message history upon updates for version control
- **Token Window Management**: Intelligent context windowing to optimize LLM performance and token usage
- **JWT Protected**: Secure, user-specific chat sessions
- **Configurable Models**: Easily switch between different AI models (default: `gemini-2.0-flash-exp`)
- **Real-time Streaming**: WebSocket-based real-time server-sent events (SSE) for chat responses
- **Model Discovery**: API endpoint to list all available Vertex AI models
- **Historical Memory Backfill**: Automatically processes past conversations to generate long-term memories ("Auto-Backfill" triggered on chat load)

**Activity Tracking System**
- **Real-time Broadcasting**: Live updates of AI agent activities (THINKING, TOOL_EXECUTION, etc.)
- **WebSocket Pub/Sub**: Dedicated `/api/activity` namespace for activity streams
- **Decorator-based Tracking**: `@TrackActivity` decorator for automatic activity publishing
- **Event Types**: THINKING, ACTING, OBSERVING, TOOL_EXECUTION, MEMORY_SEARCH, GRAPH_SEARCH

**Agentic Tools**
- **Tool Registry**: Modular tool system with automatic registration
- **Available Tools**:
  - `get_weather`: Real-time weather data fetching
  - `web_search`: Internet search capabilities
  - `search_wikipedia`: Encyclopedic knowledge queries
  - `get_stock_price`: Financial data retrieval
- **Activity Integration**: Automatic activity tracking for all tool executions
- **Context Propagation**: CLS (Continuation Local Storage) for unified logging and tracing

**Worker Pool Architecture**
- **Generic Worker Pool**: Powered by Piscina for robust concurrency management
- **Offloaded Processing**: Heavy tasks (graph extraction, memory distillation) run in worker threads
- **Thread-Safe**: Independent database connections per worker
- **Use Cases**: Backfill processing, knowledge graph extraction, semantic memory generation

### Security Features

- Bcrypt password hashing
- JWT signature validation
- HttpOnly cookies (XSS protection)
- Secure cookie flag (HTTPS only in production)
- SameSite cookie policy
- Hashed refresh token storage
- Environment-based security configuration

## Shared Library

The project includes a shared TypeScript library (`@tainiex/shared-atlas`) located in `./shared-atlas`:

- **Version**: 0.0.32
- **Purpose**: Shared interfaces and type definitions
- **Published to**: GitHub Packages (`npm.pkg.github.com`)
- **Key Exports**: DTOs, interfaces, and enums shared between backend and frontend

This ensures type consistency between frontend and backend implementations.

## Client Code Generation

Tainiex Atlas supports automatic generation of client DTOs for multiple platforms.

### Dart (Flutter)
- **Source**: `@tainiex/shared-atlas`
- **Output**: `shared-atlas-dart` directory
- **Command**: `pnpm run generate:dart`
- **Verification**: The generation command automatically runs `verify:dart` to ensure structural and content consistency using `ts-morph` AST analysis.

**Usage in Flutter**:

1.  Add dependency in `pubspec.yaml`:
    ```yaml
    dependencies:
      shared_atlas_dart: ^0.0.32 # Match the version in shared-atlas
    ```
    *If using a private pub server, ensure `publishConfig` is set correctly.*
2.  Run `flutter pub get`.

### Rust
- **Source**: `@tainiex/shared-atlas`
- **Output**: `shared-atlas-rust` directory
- **Command**: `pnpm run generate:rust`
- **Use Case**: Native Rust applications or WASM integrations

## Development

### Code Style

The project uses ESLint and Prettier for code quality:

- TypeScript strict mode enabled
- ESLint with recommended rules
- Prettier for consistent formatting
- Pre-configured in `eslint.config.mjs` and `.prettierrc`

## Architectural Decisions / 架构决策

- **Database Migrations**: `synchronize: true` is strictly **DISABLED** in all environments (including development) to ensure schema consistency. All changes must be done via migration scripts.
- **Shared DTOs**: API request/response objects MUST be defined in `shared-lib` to ensure type safety between frontend and backend.
- **Global Validation**: `ValidationPipe` is enabled globally. ALL controller endpoints MUST use DTOs with `class-validator` decorators. Use of `any` or raw objects in controllers is forbidden.
- **Scalability**: Socket.io adapter will transition to Redis in the future; currently using in-memory adapter (aware of horizontal scaling limitation).
- **Logging**: Production logs must use structured JSON format (Winston/Pino) for observability in cloud environments.

### Architecture Documentation / 架构文档规范

> **Critical Rule**: All architecture design documents MUST be stored in the `docs/` directory and follow this strict naming convention:

**Format**: `arch-design-<Number>-<Description>.md`

- `Number`: Three-digit sequence (e.g., 001, 002).
- `Description`: Brief English description in kebab-case.

**Examples**:
- `arch-design-001-websocket-state-machine.md`
- `arch-design-002-graph-rag-architecture.md`

These documents are the Source of Truth for complex architectural decisions.

### Database Migrations

TypeORM auto-synchronization is **DISABLED** by default. To make schema changes:

1. Modify your Entity files.
2. Generate migration: `npm run typeorm migration:generate src/migrations/NameOfChange`
3. Review the generated SQL.
4. Run migrations: `npm run typeorm migration:run`


### Debugging

To debug the application:

```bash
npm run start:debug
```

Then attach your debugger to port 9229.

## Security Considerations

### Production Checklist

- [ ] Set strong, random values for `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Change `NODE_ENV` to `production`
- [ ] Enable HTTPS and update cookie settings
- [ ] Disable TypeORM `synchronize` and use migrations
- [ ] Secure Google Service Account key file (never commit to git)
- [x] Configure CORS for your frontend domain (Enforced strict checking in ChatGateway)
- [x] Set up proper database backups
- [ ] Use environment variables management service (e.g., GCP Secret Manager)
- [x] Review and configure rate limiting (Basic IP limiting implemented)
- [ ] Set up proper logging and monitoring

### Environment Variables

- Never commit `.env` files to version control
- Use different credentials for development and production
- Rotate JWT secrets regularly
- Limit service account permissions to minimum required

## Contributing

We welcome contributions to Tainiex Atlas! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Contribution Guidelines

- Follow the existing code style (ESLint + Prettier)
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and well-described

## License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) for details.

## Support

- **GitHub Repository**: [https://github.com/tainiex/tainiex-atlas](https://github.com/tainiex/tainiex-atlas)
- **Issues**: Report bugs or request features via [GitHub Issues](https://github.com/tainiex/tainiex-atlas/issues)
- **Author**: zilianpn

## Acknowledgments

Built with:
- [NestJS](https://nestjs.com/) - A progressive Node.js framework
- [TypeORM](https://typeorm.io/) - ORM for TypeScript and JavaScript
- [Google Cloud Platform](https://cloud.google.com/) - Cloud infrastructure
- [Google Vertex AI](https://cloud.google.com/vertex-ai) - AI/ML capabilities

---

**Made with ❤️ for the open-source community**
