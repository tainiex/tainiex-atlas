# Tainiex Atlas

[![License: LGPL v3](https://img.shields.io/badge/License-LGPL%20v3-blue.svg)](https://www.gnu.org/licenses/lgpl-3.0)
[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-latest-336791?logo=postgresql)](https://www.postgresql.org/)

A modern, production-ready backend API built with NestJS that provides authentication, user management, and AI-powered chat capabilities using Google Vertex AI. Perfect as a starter template for building scalable applications with enterprise-grade features.

## Overview

Tainiex Atlas is a comprehensive backend solution that combines robust authentication mechanisms with cutting-edge AI integration. It provides a solid foundation for building modern web applications that require user management, secure authentication, and intelligent chat capabilities.

### Key Features

- **Dual Authentication**: Traditional username/password login and Google OAuth 2.0 integration
- **JWT Token Management**: Secure access and refresh token implementation with httpOnly cookies
- **User Profile Management**: Complete user CRUD operations with avatar support
- **AI Chat Interface**: Powered by Google Vertex AI (Gemini model) with conversation history
- **Secure File Storage**: Private avatar storage on Google Cloud Storage with signed URLs
- **Type Safety**: Full TypeScript implementation with shared type definitions
- **Production Ready**: Enterprise-grade architecture with security best practices

## Tech Stack

- **Framework**: NestJS 11.0.1
- **Language**: TypeScript 5.7.3
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT + Passport.js + Google OAuth 2.0
- **AI/ML**: Google Vertex AI (Gemini)
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
```

### 4. Set Up PostgreSQL Database

Create a PostgreSQL database:

```bash
createdb tainiex_core
```

The application will automatically synchronize the database schema on first run (development mode only).

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

### AI Chat (`/api/llm`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/llm/chat` | JWT | Send message to AI with conversation history |
| POST | `/llm/chat/stream` | JWT | Send message to AI and receive streaming response (SSE) |
| GET | `/llm/models` | JWT | List available AI models |

## Project Structure

```
tainiex-atlas/
├── src/
│   ├── auth/              # Authentication module
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts
│   │   └── jwt-auth.guard.ts
│   ├── users/             # User management module
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── user.entity.ts
│   ├── llm/               # AI chat module
│   │   ├── llm.controller.ts
│   │   └── llm.service.ts
│   ├── app.module.ts      # Root application module
│   └── main.ts            # Application entry point
├── shared-lib/            # Shared TypeScript interfaces
│   └── src/
│       └── interfaces/
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
- **Conversation History**: Support for multi-turn conversations
- **JWT Protected**: Secure, user-specific chat sessions
- **Configurable**: Easily switch between different Gemini models (default: `gemini-3-pro-preview`)
- **Streaming Support**: Real-time server-sent events (SSE) for chat responses
- **Model Discovery**: API endpoint to list all available Vertex AI models

### Security Features

- Bcrypt password hashing
- JWT signature validation
- HttpOnly cookies (XSS protection)
- Secure cookie flag (HTTPS only in production)
- SameSite cookie policy
- Hashed refresh token storage
- Environment-based security configuration

## Shared Library

The project includes a shared TypeScript library (`@tainiex/tainiex-shared`) located in `./shared-lib`:

- **Version**: 0.0.2
- **Purpose**: Shared interfaces and type definitions
- **Published to**: GitHub Packages (`npm.pkg.github.com`)
- **Key Exports**: `IUser` interface

This ensures type consistency between frontend and backend implementations.

## Development

### Code Style

The project uses ESLint and Prettier for code quality:

- TypeScript strict mode enabled
- ESLint with recommended rules
- Prettier for consistent formatting
- Pre-configured in `eslint.config.mjs` and `.prettierrc`

### Database Migrations

In development, TypeORM auto-synchronization is enabled. For production:

1. Disable `synchronize` in `app.module.ts`
2. Generate migrations: `npm run typeorm migration:generate`
3. Run migrations: `npm run typeorm migration:run`

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
- [ ] Configure CORS for your frontend domain
- [ ] Set up proper database backups
- [ ] Use environment variables management service (e.g., GCP Secret Manager)
- [ ] Review and configure rate limiting
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

This project is licensed under the GNU Lesser General Public License v3.0 or later (LGPL-3.0-or-later). See the [LICENSE](https://www.gnu.org/licenses/lgpl-3.0) for details.

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
