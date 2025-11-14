# Production Dockerfile for YukleGelTaksi Backend
FROM node:18-alpine

# Database Configuration Arguments
ARG DB_SERVER
ARG DB_USER
ARG DB_PASSWORD
ARG DB_DATABASE
ARG DB_PORT=1433
ARG DB_ENCRYPT=false
ARG DB_TRUST_SERVER_CERTIFICATE=true
ARG JWT_SECRET

# SMS Configuration Arguments
ARG VATAN_SMS_API_ID
ARG VATAN_SMS_API_KEY
ARG VATAN_SMS_SENDER
ARG SMS_TEST_MODE=false
ARG SMS_TIMEOUT=10000
ARG SMS_RETRY_COUNT=3
ARG SMS_COOLDOWN_MS=60000
ARG SMS_DAILY_LIMIT=1000
ARG SMS_HOURLY_LIMIT=100
ARG SMS_RATE_LIMIT_ENABLED=true
ARG PHONE_ENCRYPTION_KEY=your-32-character-encryption-key-here!

# Set Database environment variables
ENV DB_SERVER=$DB_SERVER
ENV DB_USER=$DB_USER
ENV DB_PASSWORD=$DB_PASSWORD
ENV DB_DATABASE=$DB_DATABASE
ENV DB_PORT=$DB_PORT
ENV DB_ENCRYPT=$DB_ENCRYPT
ENV DB_TRUST_SERVER_CERTIFICATE=$DB_TRUST_SERVER_CERTIFICATE
ENV JWT_SECRET=$JWT_SECRET

# Set SMS environment variables
ENV VATAN_SMS_API_ID=$VATAN_SMS_API_ID
ENV VATAN_SMS_API_KEY=$VATAN_SMS_API_KEY
ENV VATAN_SMS_SENDER=$VATAN_SMS_SENDER
ENV SMS_TEST_MODE=$SMS_TEST_MODE
ENV SMS_TIMEOUT=$SMS_TIMEOUT
ENV SMS_RETRY_COUNT=$SMS_RETRY_COUNT
ENV SMS_COOLDOWN_MS=$SMS_COOLDOWN_MS
ENV SMS_DAILY_LIMIT=$SMS_DAILY_LIMIT
ENV SMS_HOURLY_LIMIT=$SMS_HOURLY_LIMIT
ENV SMS_RATE_LIMIT_ENABLED=$SMS_RATE_LIMIT_ENABLED
ENV PHONE_ENCRYPTION_KEY=$PHONE_ENCRYPTION_KEY

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Copy package files
COPY package*.json package-lock.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy application code
COPY . .

# Build the Next.js application
RUN npm run build

# Database configuration is handled by environment variables in config/database.js

# Create necessary directories
RUN mkdir -p logs uploads temp \
    && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3003/api/health || exit 1

# Start command
CMD ["node", "server.js"]