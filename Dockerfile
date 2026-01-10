
# ------------------------------------
# Runtime Image
# Assumes 'dist' folder is already built by CI/CD pipeline
# ------------------------------------
FROM node:22-alpine

# Accept GITHUB_TOKEN as build argument for NPM authentication
ARG GITHUB_TOKEN

WORKDIR /usr/src/app

# Copy package definition
COPY package.json yarn.lock ./

# Copy .npmrc for GitHub Packages authentication
COPY .npmrc ./

# Install ONLY production dependencies (including @tainiex/shared from GitHub Packages)
# Set GITHUB_TOKEN as env var so .npmrc can use it
RUN export GITHUB_TOKEN=${GITHUB_TOKEN} && \
    yarn install --production --frozen-lockfile && \
    rm -f .npmrc

# Copy the pre-built application from CI/CD pipeline
COPY dist ./dist

# Expose port (Cloud Run sets PORT env var automatically)
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Run the application
CMD ["node", "dist/src/main"]
