### Build the frontend
# Using specific digest for multi-arch support (amd64, arm64)
FROM node:20-alpine AS frontend-builder
WORKDIR /usr/src/app/frontend
# Copy frontend sources
COPY frontend/package.json frontend/package-lock.json* ./
COPY frontend/ ./
RUN npm ci && npm run build

### Build the backend and copy frontend assets
# Using alpine for smaller image size and multi-arch support
FROM node:20-alpine AS backend
WORKDIR /usr/src/app
RUN apk add --no-cache tini

# Copy backend package manifests and install production deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --only=production

# Copy backend source
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
COPY schema.sql ./schema.sql

# Copy built frontend assets into backend
COPY --from=frontend-builder /usr/src/app/frontend/dist ./frontend/dist

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
