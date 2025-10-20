# Multi-stage Dockerfile for tRPC Wordle Monorepo

# Stage 1: Base image with Bun
FROM oven/bun:1.3.0-alpine AS base
WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps
# Copy package files
COPY package.json bun.lock* ./
COPY turbo.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN bun install --frozen-lockfile

# Stage 3: Build applications
FROM base AS builder
# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source code
COPY package.json bun.lock* ./
COPY turbo.json ./
COPY apps/ ./apps/

# Build all applications
RUN bun run build

# Stage 4: Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built applications
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/package.json ./

# Install only production dependencies for server
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules

# Change ownership to nodejs user
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose ports
EXPOSE 3000
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Default command - start the server
CMD ["bun", "run", "apps/server/dist/src/index.js"]
