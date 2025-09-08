# YükleGel Taksi API Endpoints

Base URL: `http://192.168.1.14:3000/api`

## Sürücü Endpoints

### GET /api/drivers
Tüm sürücüleri listeler.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "first_name": "Ahmet",
      "last_name": "Yılmaz",

      "email": "ahmet@example.com",
      "license_number": "34ABC123",
      "vehicle_plate": "34 XYZ 123",
      "vehicle_model": "Toyota Corolla",
      "vehicle_year": 2020,
      "is_verified": true,
      "is_approved": true,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 4. Sürücü Onaylama
**Endpoint:** `POST /api/drivers/approve`

**Açıklama:** Sürücü başvurusunu onaylar veya onayını kaldırır.

**İstek Gövdesi:**
```json
{
  "driverId": 1,
  "isApproved": true
}
```

**Parametreler:**
- `driverId` (number, required): Sürücünün ID'si
- `isApproved` (boolean, required): Onay durumu (true: onaylandı, false: onay kaldırıldı)

**Yanıt:**
```json
{
  "success": true,
  "message": "Sürücü onaylandı",
  "driver": {
    "id": 1,
    "first_name": "Ahmet",
    "last_name": "Yılmaz",

    "is_approved": true,
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**Hata Yanıtları:**
- `400`: Driver ID ve onay durumu gerekli
- `404`: Sürücü bulunamadı
- `500`: Sunucu hatası

### 5. Sürücü Onay Durumu Sorgula
**Endpoint:** `GET /api/drivers/approve?driverId={driverId}`

**Açıklama:** Belirli bir sürücünün onay durumunu sorgular.

**Parametreler:**
- `driverId` (number, required): Sürücünün ID'si

**Yanıt:**
```json
{
  "success": true,
  "driver": {
    "id": 1,
    "first_name": "Ahmet",
    "last_name": "Yılmaz",
    "phone": "+905551234567",
    "is_approved": true,
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### 6. Sürücü Kaydı
**Endpoint:** `POST /api/drivers/register`
Yeni sürücü kaydı oluşturur.

**Request Body (multipart/form-data):**
- `firstName`: string
- `lastName`: string

- `email`: string
- `licenseNumber`: string
- `vehiclePlate`: string
- `vehicleModel`: string
- `vehicleYear`: number
- `vehicleColor`: string
- `profilePhoto`: file (optional)
- `licensePhoto`: file (optional)
- `vehiclePhoto`: file (optional)
- `insuranceDocument`: file (optional)

**Response:**
```json
{
  "success": true,
  "message": "Sürücü başvurusu başarıyla oluşturuldu",
  "data": {
    "id": 1,
    "first_name": "Ahmet",
    "last_name": "Yılmaz",
    "phone_number": "+905551234567",
    "is_verified": false,
    "is_active": false
  }
}
```

### GET /api/drivers/status
Sürücünün başvuru durumunu kontrol eder.

**Query Parameters:**
- `phone`: string (required) - Telefon numarası

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "first_name": "Ahmet",
    "last_name": "Yılmaz",
    "phone": "+905551234567",
    "is_approved": true,
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "status": "approved"
  }
}
```

**Error Response (404):**
```json
{
  "error": "Sürücü kaydı bulunamadı"
}
```

## Dosya Upload Endpoints

### POST /api/files/upload
Dosya yükleme endpoint'i.

**Request Body (multipart/form-data):**
- `file`: file (required)

**Response:**
```json
{
  "success": true,
  "filename": "uploaded-file-name.jpg",
  "path": "/uploads/uploaded-file-name.jpg"
}
```

## Hata Kodları

- `400`: Bad Request - Geçersiz istek
- `404`: Not Found - Kaynak bulunamadı
- `500`: Internal Server Error - Sunucu hatası