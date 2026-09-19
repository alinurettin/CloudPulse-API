# Multi-stage production container for CloudPulse-API
FROM node:18-alpine AS base

WORKDIR /app

# Copy package manifests
COPY package.json ./

# Copy application source and web assets
COPY src/ ./src/
COPY public/ ./public/

# Expose HTTP port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Healthcheck probe against internal endpoint
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Non-root secure runtime
USER node

CMD ["node", "src/index.js"]
