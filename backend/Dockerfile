# Multi-stage build for production optimization
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files with cache invalidation
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:24-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S backend -u 1001 -G nodejs

# Copy built application from builder stage
COPY --from=builder --chown=backend:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=backend:nodejs /app/package*.json ./
COPY --from=builder --chown=backend:nodejs /app/.next ./.next
COPY --from=builder --chown=backend:nodejs /app/public ./public
COPY --from=builder --chown=backend:nodejs /app/server.js ./
COPY --from=builder --chown=backend:nodejs /app/socket ./socket
COPY --from=builder --chown=backend:nodejs /app/config ./config
COPY --from=builder --chown=backend:nodejs /app/middleware ./middleware
COPY --from=builder --chown=backend:nodejs /app/services ./services
COPY --from=builder --chown=backend:nodejs /app/utils ./utils
COPY --from=builder --chown=backend:nodejs /app/types ./types
COPY --from=builder --chown=backend:nodejs /app/migrations ./migrations
COPY --from=builder --chown=backend:nodejs /app/database ./database
COPY --from=builder --chown=backend:nodejs /app/lib ./lib

# Uploads klasörü için izin ver
RUN mkdir -p /app/public/uploads/vehicle-types && \
    chown -R backend:nodejs /app/public/uploads

# Switch to non-root user
USER backend

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "start"]