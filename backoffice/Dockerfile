# Build aşaması
FROM node:20-alpine AS build

WORKDIR /app

# Build argümanlarını tanımla
ARG REACT_APP_API_URL
ARG REACT_APP_BACKEND_URL
ARG REACT_APP_SOCKET_URL
ARG REACT_APP_ENVIRONMENT
ARG REACT_APP_GOOGLE_MAPS_API_KEY

# Environment değişkenlerini ayarla
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}
ENV REACT_APP_SOCKET_URL=${REACT_APP_SOCKET_URL}
ENV REACT_APP_ENVIRONMENT=${REACT_APP_ENVIRONMENT}
ENV REACT_APP_GOOGLE_MAPS_API_KEY=${REACT_APP_GOOGLE_MAPS_API_KEY}

# package.json ve package-lock.json'ı kopyala
COPY package*.json ./

# npm cache'ini temizle ve npm install'yi çalıştır
RUN npm cache clean --force && npm install

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