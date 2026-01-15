
# ------------------------------------
# Runtime Image
# Assumes 'dist' and 'node_modules' are already built by CI/CD pipeline
# ------------------------------------
# Use debian-based slim image to match GitHub Actions runner (Ubuntu) closer than Alpine
# This reduces risk of native module (bcrypt) incompatibility with pipeline-built modules
FROM node:22-slim

WORKDIR /usr/src/app

# Copy package definition
# Copy package definition
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy shared library source code (needed for local dependency)
COPY shared-atlas ./shared-atlas

# Install pnpm
# Using corepack to ensure correct version if available, or just installing it
RUN npm install -g pnpm

# Copy production dependencies pre-installed by pipeline
# In multi-stage builds we typically copy them, but here we might need to reinstall or rely on provided modules.
# However, for consistency with pnpm, we should ideally run pnpm install in a build stage or here. 
# Given the previous pattern, let's stick to copying. BUT pnpm is stricter about hoisting.
# Safer approach for Cloud Run with pnpm:
RUN pnpm install --prod --frozen-lockfile

# Copy the pre-built application from CI/CD pipeline
COPY dist ./dist

# Expose port (Cloud Run sets PORT env var automatically)
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Run the application
CMD ["node", "dist/main"]
