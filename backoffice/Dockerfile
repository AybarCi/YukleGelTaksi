# Build aşaması
FROM node:18-alpine AS build

WORKDIR /app

# package.json ve package-lock.json'ı kopyala
COPY package*.json ./

# Tüm bağımlılıkları yükle (dev dependencies dahil)
RUN npm ci

# Uygulama dosyalarını kopyala
COPY . .

# Production build oluştur
RUN npm run build

# Production aşaması
FROM nginx:alpine

# Nginx konfigürasyonunu kopyala
COPY nginx.conf /etc/nginx/nginx.conf

# Build edilmiş dosyaları kopyala
COPY --from=build /app/build /usr/share/nginx/html

# Healthcheck için curl yükle
RUN apk add --no-cache curl

# Healthcheck endpoint'i
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:80/health || exit 1

# 80 portunu aç
EXPOSE 80

# Nginx'i başlat
CMD ["nginx", "-g", "daemon off;"]