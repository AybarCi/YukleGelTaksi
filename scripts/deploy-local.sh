#!/bin/bash

# Local Production Deployment Script
set -e

echo "🚀 Starting local production deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose is not installed. Please install it first."
    exit 1
fi

# Check environment file
if [ ! -f "backend/.env.production" ]; then
    print_warning "Production environment file not found. Creating from example..."
    cp backend/.env.production.example backend/.env.production
    print_warning "Please edit backend/.env.production with your actual values before continuing."
    read -p "Press Enter to continue after editing the file..."
fi

# Create SSL directory if it doesn't exist
if [ ! -d "nginx/ssl" ]; then
    print_status "Creating SSL directory..."
    mkdir -p nginx/ssl
    print_warning "Please place your SSL certificates in nginx/ssl/ directory:"
    print_warning "  - cert.pem (full certificate chain)"
    print_warning "  - key.pem (private key)"
    read -p "Press Enter to continue after placing certificates..."
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down --remove-orphans

# Build the images
print_status "Building Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Start the services
print_status "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
print_status "Waiting for services to start..."
sleep 30

# Health check
print_status "Performing health check..."
max_attempts=10
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -f -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health | grep -q "200"; then
        print_status "✅ Health check passed! Application is running."
        break
    else
        print_warning "Health check failed (attempt $attempt/$max_attempts). Retrying in 15 seconds..."
        sleep 15
        attempt=$((attempt + 1))
    fi
done

if [ $attempt -gt $max_attempts ]; then
    print_error "❌ Health check failed after $max_attempts attempts."
    print_error "Check the logs with: docker-compose -f docker-compose.prod.yml logs"
    exit 1
fi

# Show status
print_status "Deployment completed successfully!"
echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "🔗 URLs:"
echo "  - Application: http://localhost:3000"
echo "  - Health Check: http://localhost:3000/api/health"
echo ""
echo "📋 Useful Commands:"
echo "  - View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "  - Stop services: docker-compose -f docker-compose.prod.yml down"
echo "  - Restart: docker-compose -f docker-compose.prod.yml restart"
echo ""
print_status "🎉 Local production deployment is complete!"