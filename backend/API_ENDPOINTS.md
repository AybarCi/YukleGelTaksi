# YükleGel Taksi Backend API Endpoints

Backend sunucusu `http://localhost:3001` adresinde çalışmaktadır.

## Authentication Endpoints

### SMS Kodu Gönder
```
POST /api/auth/send-code
Content-Type: application/json

{
  "phoneNumber": "+905551234567"
}
```

### SMS Kodu Doğrula
```
POST /api/auth/verify-code
Content-Type: application/json

{
  "phoneNumber": "+905551234567",
  "code": "123456"
}
```

## User Profile Endpoints

### Profil Bilgilerini Al
```
GET /api/users/profile
Authorization: Bearer <token>
```

### Profil Bilgilerini Güncelle
```
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "Ahmet",
  "lastName": "Yılmaz",
  "email": "ahmet@example.com",
  "dateOfBirth": "1990-01-01",
  "gender": "male"
}
```

## Address Management Endpoints

### Adresleri Listele
```
GET /api/users/addresses
Authorization: Bearer <token>
```

### Yeni Adres Ekle
```
POST /api/users/addresses
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Ev",
  "address": "Atatürk Caddesi No:123 Kadıköy/İstanbul",
  "latitude": 40.9923,
  "longitude": 29.0244,
  "isDefault": true
}
```

### Adres Güncelle
```
PUT /api/users/addresses
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": 1,
  "title": "İş Yeri",
  "address": "Levent Mahallesi Büyükdere Caddesi No:456",
  "isDefault": false
}
```

### Adres Sil
```
DELETE /api/users/addresses/delete
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": 1
}
```

## Trip Management Endpoints

### Yolculuk Oluştur
```
POST /api/trips/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "pickupAddress": "Kadıköy Meydanı",
  "pickupLatitude": 40.9923,
  "pickupLongitude": 29.0244,
  "destinationAddress": "Taksim Meydanı",
  "destinationLatitude": 41.0370,
  "destinationLongitude": 28.9857,
  "paymentMethod": "cash"
}
```

### Yolculuk Durumunu Kontrol Et
```
GET /api/trips/status
Authorization: Bearer <token>
```

### Yolculuğu İptal Et
```
POST /api/trips/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "tripId": 1,
  "reason": "Planlarım değişti"
}
```

### Yolculuk Geçmişi
```
GET /api/trips/history?page=1&limit=10&status=completed
Authorization: Bearer <token>
```

### Yolculuğu Değerlendir
```
POST /api/trips/rate
Authorization: Bearer <token>
Content-Type: application/json

{
  "tripId": 1,
  "rating": 5,
  "comment": "Çok iyi bir sürücüydü, teşekkürler!"
}
```

## Driver Endpoints

### Yakındaki Sürücüleri Bul
```
POST /api/drivers/nearby
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 40.9923,
  "longitude": 29.0244,
  "radius": 5
}
```

## Response Format

Tüm API yanıtları JSON formatındadır:

### Başarılı Yanıt
```json
{
  "message": "İşlem başarılı",
  "data": { ... }
}
```

### Hata Yanıtı
```json
{
  "error": "Hata mesajı"
}
```

## HTTP Status Codes

- `200` - Başarılı
- `201` - Oluşturuldu
- `400` - Geçersiz istek
- `401` - Yetkilendirme gerekli
- `404` - Bulunamadı
- `500` - Sunucu hatası

## Authentication

API'lerin çoğu Bearer token ile yetkilendirme gerektirir. Token'ı Authorization header'ında gönderin:

```
Authorization: Bearer <your-token-here>
```

Token'ı `/api/auth/verify-code` endpoint'inden alabilirsiniz.