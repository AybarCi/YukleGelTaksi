# YükleGel Taksi - Merkezi Konfigürasyon Sistemi

Bu proje artık **merkezi konfigürasyon sistemi** kullanmaktadır. Tüm IP adresleri, API URL'leri ve diğer konfigürasyon değerleri tek bir yerden yönetilir.

## 🎯 Merkezi Konfigürasyon Avantajları

- ✅ **Tek Nokta Yönetimi**: IP adresi değişikliği sadece `.env` dosyasından yapılır
- ✅ **Environment Desteği**: Development/Production ortamları otomatik algılanır  
- ✅ **Tutarlılık**: Tüm uygulamalar aynı konfigürasyonu kullanır
- ✅ **Kolay Deployment**: Production'da sadece environment variables değiştirilir

## 📁 Konfigürasyon Dosyaları

### Ana Konfigürasyon
- **`.env`** - Merkezi environment variables
- **`packages/shared/src/config/environment.ts`** - Merkezi konfigürasyon helper

### Uygulama Konfigürasyonları (Shared config'i kullanır)
- `packages/customer-app/config/api.ts`
- `packages/driver-app/config/api.ts` 
- `backoffice/src/config/api.ts`
- `config/api.ts`

## 🔧 Konfigürasyon Kullanımı

### Environment Variables (.env)
```bash
# Server Configuration
API_HOST=172.2.2.36
API_PORT=3000
SOCKET_PORT=3001

# Environment
NODE_ENV=development

# Production URLs
PROD_API_URL=https://api.yuklegeltaksi.com
PROD_SOCKET_URL=https://socket.yuklegeltaksi.com

# Google Maps API Keys
GOOGLE_MAPS_API_KEY=your-api-key
GOOGLE_PLACES_API_KEY_IOS=your-ios-key
GOOGLE_PLACES_API_KEY_ANDROID=your-android-key
```

### Kod İçinde Kullanım
```typescript
import { API_CONFIG } from '../config/api';

// Otomatik olarak environment'a göre URL oluşturulur
const response = await fetch(`${API_CONFIG.BASE_URL}/api/users`);
const socket = io(API_CONFIG.SOCKET_URL);
```

## 🚀 IP Adresi Değiştirme

Artık IP adresi değiştirmek için **sadece `.env` dosyasını** düzenleyin:

```bash
# .env dosyasında
API_HOST=172.2.2.36  # Yeni IP adresi (örnek)
```

Tüm uygulamalar otomatik olarak yeni IP adresini kullanacaktır!

## 🌍 Environment Yönetimi

### Development
```bash
NODE_ENV=development
API_HOST=172.2.2.36
```
→ URLs: `http://172.2.2.36:3000`, `http://172.2.2.36:3001`

### Production  
```bash
NODE_ENV=production
PROD_API_URL=https://api.yuklegeltaksi.com
PROD_SOCKET_URL=https://socket.yuklegeltaksi.com
```
→ URLs: Production domain'leri kullanılır

## 📦 Proje Yapısı

```
YukleGelTaksi/
├── .env                          # 🔥 Merkezi environment variables
├── packages/
│   ├── shared/
│   │   └── src/config/
│   │       └── environment.ts    # 🔥 Merkezi konfigürasyon helper
│   ├── customer-app/
│   │   └── config/api.ts        # Shared config'i kullanır
│   └── driver-app/
│       └── config/api.ts        # Shared config'i kullanır
├── backoffice/
│   └── src/config/api.ts        # Shared config'i kullanır
└── config/
    └── api.ts                   # Shared config'i kullanır
```

## ⚡ Hızlı Başlangıç

1. **Environment dosyasını kopyalayın:**
   ```bash
   cp .env.example .env  # (eğer varsa)
   ```

2. **IP adresini güncelleyin:**
   ```bash
   # .env dosyasında
   API_HOST=your-local-ip
   ```

3. **Uygulamaları başlatın:**
   ```bash
   # Backend
   cd backend && npm start
   
   # Customer App  
   cd packages/customer-app && npm start
   
   # Driver App
   cd packages/driver-app && npm start
   
   # Backoffice
   cd backoffice && npm start
   ```

## 🔒 Güvenlik

- `.env` dosyası git'e commit edilmez
- Production'da environment variables server'da ayarlanır
- API key'ler güvenli şekilde saklanır

---

**Artık IP adresi değiştirmek için 50 dosyayı düzenlemenize gerek yok! 🎉**