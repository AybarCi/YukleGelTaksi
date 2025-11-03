# Backoffice Production Deployment Guide

## Overview
This guide explains how to deploy the backoffice application in production using Docker and Portainer.

## Prerequisites
- Docker and Docker Compose installed
- Portainer access
- GitHub Container Registry access
- Network connectivity to backend services

## Quick Start

### 1. Build and Push Image (Automated via GitHub Actions)
The image is automatically built and pushed when you push to `main` or `develop` branches.

### 2. Deploy in Portainer

#### Option A: Using Docker Compose
1. Go to Portainer → Stacks → Add Stack
2. Name: `yuklegeltaksi-backoffice`
3. Copy contents from `docker-compose.prod.yml`
4. Set environment variables if needed
5. Deploy the stack

#### Option B: Using Docker CLI
```bash
# Pull the latest image
docker pull ghcr.io/aybarci/yuklegeltaksi/backoffice:main

# Run the container
docker-compose -f backoffice/docker-compose.prod.yml up -d
```

## Configuration

### Environment Variables
Copy `.env.production.example` to `.env.production` and update values:
```bash
cp .env.production.example .env.production
```

### Network Configuration
Ensure the `yuklegeltaksi-network` exists:
```bash
docker network create yuklegeltaksi-network
```

### Port Configuration
- **Application Port**: 3000 (mapped to container port 80)
- **Backend API**: 3003 (internal communication)
- **Redis**: 6380 (mapped to container port 6379)

## Health Checks
The application includes health checks:
- **Backoffice**: `http://localhost:3000/health`
- **Backend**: `http://localhost:3003/health`
- **Redis**: `redis-cli ping`

## Monitoring

### Logs
```bash
# View logs
docker logs yuklegeltaksi-backoffice

# Follow logs
docker logs -f yuklegeltaksi-backoffice
```

### Performance Metrics
- CPU Usage: Monitor via Portainer
- Memory Usage: Monitor via Portainer
- Response Time: Check application logs
- Error Rate: Monitor container logs

## Security Considerations

### Nginx Configuration
- Rate limiting enabled (10 req/s for API, 5 req/m for login)
- Security headers configured
- CORS properly configured

### Environment Variables
- Never commit sensitive data
- Use Portainer secrets for sensitive information
- Rotate keys regularly

## Troubleshooting

### Common Issues

1. **Container unhealthy**
   - Check health endpoint: `curl http://localhost:3000/health`
   - Review logs for errors
   - Ensure backend is accessible

2. **Cannot connect to backend**
   - Verify backend container is running
   - Check network connectivity
   - Validate environment variables

3. **Build failures**
   - Check Node.js version compatibility
   - Verify all dependencies are installed
   - Review build logs in GitHub Actions

### Support
For issues and questions:
- Check application logs
- Review GitHub Actions build logs
- Verify network connectivity
- Check environment configuration

## Updates
To update the application:
1. Push changes to GitHub
2. Wait for GitHub Actions to build and push
3. Update the stack in Portainer
4. Monitor health status