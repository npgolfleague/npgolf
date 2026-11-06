### Build the frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /usr/src/app/frontend
# Copy frontend sources
COPY frontend/package.json frontend/package-lock.json* ./
COPY frontend/ ./
RUN npm ci && npm run build

### Build the backend and copy frontend assets
FROM node:20-alpine AS backend
WORKDIR /usr/src/app
RUN apk add --no-cache tini chromium nss freetype harfbuzz ca-certificates ttf-freefont

# Set Chromium path for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

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

# Version details stamped in at build time (shown at /api/version and in the app).
# Declared last so changing them doesn't invalidate the cached layers above.
ARG GIT_COMMIT=unknown
ARG GIT_BRANCH=unknown
ARG BUILD_TIME=unknown
ENV GIT_COMMIT=$GIT_COMMIT \
    GIT_BRANCH=$GIT_BRANCH \
    BUILD_TIME=$BUILD_TIME

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
