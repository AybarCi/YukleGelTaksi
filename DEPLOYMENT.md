# 🚀 Production Deployment Guide

## Prerequisites

- Docker & Docker Compose installed
- Portainer access
- GitHub repository secrets configured
- Domain and SSL certificates ready

## 🏗️ Local Production Test

1. **Environment Setup:**
   ```bash
   cd backend
   cp .env.production.example .env.production
   # Edit .env.production with actual values
   ```

2. **Build and Test Locally:**
   ```bash
   docker-compose -f docker-compose.prod.yml build
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Health Check:**
   ```bash
   curl http://localhost:3000/api/health
   ```

## 🔐 GitHub Secrets Configuration

Required secrets in GitHub repository settings:

```
PORTAINER_URL=https://your-portainer-instance.com
PORTAINER_API_KEY=your-portainer-api-key
PORTAINER_ENDPOINT_ID=your-endpoint-id
DB_SERVER=your-azure-sql-server.database.windows.net
DB_USER=your-db-username
DB_PASSWORD=your-db-password
DB_NAME=yuklegeltaksidb
DB_PORT=1433
JWT_SECRET=your-jwt-secret-min-32-chars
REDIS_URL=redis://redis:6379
API_BASE_URL=https://your-domain.com
SLACK_WEBHOOK=your-slack-webhook-url (optional)
```

## 📁 SSL Certificates

1. Create SSL directory:
   ```bash
   mkdir -p nginx/ssl
   ```

2. Place your certificates:
   - `nginx/ssl/cert.pem` - Full certificate chain
   - `nginx/ssl/key.pem` - Private key

3. Set proper permissions:
   ```bash
   chmod 600 nginx/ssl/key.pem
   chmod 644 nginx/ssl/cert.pem
   ```

## 🚀 Automated Deployment

### GitHub Actions Workflow

The workflow automatically:
1. Runs tests on every push
2. Builds Docker image on main branch
3. Pushes to GitHub Container Registry
4. Deploys to Portainer
5. Performs health checks

### Manual Trigger

You can also manually trigger deployment:
1. Go to GitHub Actions tab
2. Select "Backend Deploy" workflow
3. Click "Run workflow"

## 🔧 Portainer Configuration

1. **Stack Configuration:**
   - Name: `yuklegeltaksi-backend`
   - Environment variables from GitHub secrets
   - Auto-update on new image push

2. **Resource Limits:**
   - CPU: 1.0 core
   - Memory: 1GB
   - Restart policy: Unless stopped

## 📊 Monitoring

### Health Checks
- Application: `https://your-domain.com/api/health`
- Container health checks every 30s
- Auto-restart on failure

### Logs
```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f backend

# View specific service logs
docker-compose -f docker-compose.prod.yml logs -f redis
```

## 🔒 Security Features

- Non-root container user
- Rate limiting on API endpoints
- SSL/TLS termination at nginx
- Security headers
- CORS configuration
- Input validation

## 🔄 Rollback

If deployment fails:
1. Check GitHub Actions logs
2. Portainer will keep previous version running
3. Manual rollback via Portainer UI
4. Check health endpoint response

## 🐛 Troubleshooting

### Common Issues:

1. **Database Connection:**
   - Check Azure SQL firewall rules
   - Verify connection string
   - Test with local connection

2. **SSL Certificate Issues:**
   - Verify certificate chain
   - Check file permissions
   - Ensure domain matches

3. **Portainer Deployment:**
   - Verify API key permissions
   - Check endpoint connectivity
   - Review stack logs

4. **Container Issues:**
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   docker-compose -f docker-compose.prod.yml logs backend
   ```

## 📞 Support

- Check application logs: `docker-compose logs backend`
- Monitor health: `curl https://your-domain.com/api/health`
- Review GitHub Actions logs
- Check Portainer stack status