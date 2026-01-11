
# ------------------------------------
# Runtime Image
# Assumes 'dist' and 'node_modules' are already built by CI/CD pipeline
# ------------------------------------
# Use debian-based slim image to match GitHub Actions runner (Ubuntu) closer than Alpine
# This reduces risk of native module (bcrypt) incompatibility with pipeline-built modules
FROM node:22-slim

WORKDIR /usr/src/app

# Copy package definition
COPY package.json yarn.lock ./

# Copy shared library source code (needed for local dependency)
COPY shared-atlas ./shared-atlas

# Copy production dependencies pre-installed by pipeline
COPY node_modules ./node_modules

# Copy the pre-built application from CI/CD pipeline
COPY dist ./dist

# Expose port (Cloud Run sets PORT env var automatically)
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Run the application
CMD ["node", "dist/src/main"]
