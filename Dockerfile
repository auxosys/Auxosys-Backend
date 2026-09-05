# ============================================================
# Dockerfile for Auxosys Backend (AWS ECS / App Runner Ready)
# ============================================================

FROM node:20-alpine AS base

# Install curl for health check
RUN apk add --no-cache curl

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy source files
COPY . .

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=5002

EXPOSE 5002

# AWS ALB / Container Health Check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5002/health || exit 1

CMD ["node", "server.js"]
