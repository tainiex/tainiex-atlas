# ------------------------------------
# Stage 1: Build Shared Packages
# ------------------------------------
FROM node:22-slim AS shared-builder

WORKDIR /usr/src/app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install pnpm
RUN npm install -g pnpm@10.28.0

# Copy shared package
COPY packages/shared-atlas ./packages/shared-atlas

# Install dependencies and build shared package
RUN pnpm install --filter @tainiex/shared-atlas --frozen-lockfile
RUN pnpm --filter @tainiex/shared-atlas build

# ------------------------------------
# Stage 2: Build API
# ------------------------------------
FROM node:22-slim AS api-builder

WORKDIR /usr/src/app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install pnpm
RUN npm install -g pnpm@10.28.0

# Copy built shared package from previous stage
COPY --from=shared-builder /usr/src/app/packages/shared-atlas ./packages/shared-atlas

# Copy API application
COPY apps/api ./apps/api

# Install dependencies
RUN pnpm install --filter @tainiex/api --frozen-lockfile

# Build API
RUN pnpm --filter @tainiex/api build

# ------------------------------------
# Stage 3: Runtime Image
# ------------------------------------
FROM node:22-slim

WORKDIR /usr/src/app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy shared package (needed for runtime)
COPY --from=shared-builder /usr/src/app/packages/shared-atlas ./packages/shared-atlas

# Copy API package.json
COPY apps/api/package.json ./apps/api/

# Install pnpm
RUN npm install -g pnpm@10.28.0

# Install production dependencies
RUN pnpm install --filter @tainiex/api --prod --frozen-lockfile

# Copy built API application
COPY --from=api-builder /usr/src/app/apps/api/dist ./apps/api/dist

# Expose port (Cloud Run sets PORT env var automatically)
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Run the application
CMD ["node", "apps/api/dist/main"]
