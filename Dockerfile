
# ------------------------------------
# Runtime Image
# Assumes 'dist' folder is already built externally
# ------------------------------------
FROM node:22-alpine

WORKDIR /usr/src/app

# Copy package definition
COPY package.json yarn.lock ./

# Copy local dependencies required for install
COPY shared-lib ./shared-lib

# Install ONLY production dependencies
RUN yarn install --production --frozen-lockfile

# Copy the pre-built application from host
COPY dist ./dist

# Expose port (Cloud Run sets PORT env var automatically)
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Run the application
CMD ["node", "dist/src/main"]
