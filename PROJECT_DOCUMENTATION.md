# YükleGel Taksi Projesi - Kapsamlı Dokümantasyon

## Proje Genel Bakış

YükleGel Taksi, müşteriler ve taksi sürücüleri arasında aracılık yapan kapsamlı bir mobil uygulama ve yönetim sistemidir. Proje, React Native tabanlı mobil uygulama, Node.js backend API, React tabanlı backoffice yönetim paneli ve SQL Server veritabanından oluşmaktadır.

---

## 📱 APP (Mobil Uygulama)

### Teknoloji Stack
- **Framework:** React Native + Expo
- **Routing:** Expo Router
- **State Management:** React Context API
- **UI Components:** React Native + Custom Components
- **Maps:** React Native Maps + Google Maps API
- **Real-time Communication:** Socket.IO Client

### Ana Özellikler

#### 1. Kimlik Doğrulama Sistemi
- **Dosyalar:** `phone-auth.tsx`, `verify-code.tsx`, `user-info.tsx`
- **Amaç:** Güvenli telefon numarası tabanlı giriş sistemi
- **Özellikler:**
  - SMS ile doğrulama kodu gönderimi
  - Kullanıcı profil bilgileri toplama
  - JWT token tabanlı oturum yönetimi

#### 2. Müşteri Arayüzü
- **Ana Sayfa:** `home.tsx` - Taksi çağırma, konum seçimi
- **Menü:** `customer-menu.tsx` - Navigasyon ve hızlı erişim
- **Hesap Yönetimi:** `account-details.tsx` - Profil bilgileri, çıkış işlemleri
- **Ayarlar:** `settings.tsx` - Uygulama tercihleri
- **Gönderiler:** `shipments.tsx` - Kargo/paket gönderim takibi

#### 3. Sürücü Arayüzü
- **Dashboard:** `driver-dashboard.tsx` - Sürücü ana ekranı
- **Profil:** `driver-profile.tsx` - Sürücü bilgileri
- **Kazançlar:** `driver-earnings.tsx` - Gelir takibi
- **Değerlendirmeler:** `driver-reviews.tsx` - Müşteri yorumları
- **Sipariş Geçmişi:** `driver-order-history.tsx` - Tamamlanan yolculuklar
- **Durum Yönetimi:** `driver-status.tsx` - Çevrimiçi/çevrimdışı durumu

#### 4. Sürücü Kayıt Sistemi
- **Dosya:** `driver-registration.tsx`
- **Amaç:** Yeni sürücülerin platforma katılımı
- **Özellikler:**
  - Kişisel bilgi toplama
  - Belge yükleme (ehliyet, ruhsat, sigorta)
  - Araç bilgileri kaydetme
  - Onay süreci başlatma

#### 5. Harita ve Konum Servisleri
- **Bileşenler:** `InteractiveMap.tsx`, `LocationPicker.tsx`, `LocationInput.tsx`
- **Özellikler:**
  - Gerçek zamanlı konum takibi
  - Adres arama ve seçimi
  - Rota hesaplama
  - Sürücü konumu görüntüleme

#### 6. Rezervasyon ve Takip
- **Bileşenler:** `BookingModal.tsx`, `TrackingScreen.tsx`
- **Özellikler:**
  - Taksi rezervasyonu
  - Gerçek zamanlı yolculuk takibi
  - Fiyat hesaplama
  - Ödeme işlemleri

### Neden Bu Yapı Seçildi?

1. **Expo Framework:** Hızlı geliştirme ve kolay deployment
2. **Context API:** Basit state yönetimi, Redux'a göre daha hafif
3. **Socket.IO:** Gerçek zamanlı iletişim için güvenilir çözüm
4. **Modüler Yapı:** Her ekran ayrı dosya, bakım kolaylığı
5. **TypeScript:** Tip güvenliği ve geliştirici deneyimi

---

## 🔧 BACKEND (API Sunucusu)

### Teknoloji Stack
- **Runtime:** Node.js
- **Framework:** Next.js (API Routes)
- **Database:** SQL Server + SQLite (development)
- **Real-time:** Socket.IO
- **Authentication:** JWT
- **File Upload:** Multer
- **Validation:** Joi

### Proje Yapısı

#### 1. Ana Sunucu
- **Dosya:** `server.js`
- **Amaç:** HTTP ve Socket.IO sunucularını başlatma
- **Özellikler:**
  - Next.js ile API routing
  - Socket.IO entegrasyonu
  - Error handling
  - Port ve hostname konfigürasyonu

#### 2. Veritabanı Konfigürasyonu
- **Dosyalar:** `config/database.js`, `config/sqlite-database.ts`
- **Amaç:** Farklı ortamlar için veritabanı bağlantıları
- **Özellikler:**
  - Production: SQL Server (Azure)
  - Development: SQLite
  - Connection pooling
  - Error handling

#### 3. API Endpoints
- **Sürücü Yönetimi:** `/api/drivers/*`
  - Sürücü kaydı ve onaylama
  - Durum sorgulama
  - Profil güncelleme
- **Dosya Yükleme:** `/api/files/upload`
  - Belge ve fotoğraf yükleme
  - Güvenli dosya işleme
- **Kullanıcı Yönetimi:** Kimlik doğrulama ve profil

#### 4. Socket.IO Servisi
- **Dosya:** `socket/socketServer.js`
- **Amaç:** Gerçek zamanlı iletişim
- **Özellikler:**
  - Sürücü-müşteri eşleştirme
  - Konum güncellemeleri
  - Yolculuk durumu takibi
  - Bildirim sistemi

#### 5. Middleware
- **Güvenlik:** Helmet, CORS, Rate limiting
- **Kimlik Doğrulama:** JWT token validation
- **Dosya İşleme:** Multer configuration

### Veritabanı Şeması

#### Ana Tablolar
1. **users:** Kullanıcı bilgileri (müşteri/sürücü)
2. **drivers:** Sürücü özel bilgileri
3. **user_addresses:** Kullanıcı adresleri
4. **rides:** Yolculuk kayıtları
5. **payments:** Ödeme işlemleri
6. **reviews:** Değerlendirmeler
7. **system_settings:** Sistem konfigürasyonu

### Neden Bu Yapı Seçildi?

1. **Next.js:** API routes ile kolay endpoint yönetimi
2. **Socket.IO:** Gerçek zamanlı özellikler için endüstri standardı
3. **SQL Server:** Kurumsal düzeyde güvenilirlik
4. **SQLite:** Development ortamında hızlı setup
5. **Modüler Yapı:** Mikroservis mimarisine geçiş kolaylığı

---

## 💼 BACKOFFICE (Yönetim Paneli)

### Teknoloji Stack
- **Framework:** React 19
- **UI Library:** Material-UI (MUI)
- **Charts:** Chart.js, Recharts
- **Routing:** React Router DOM
- **HTTP Client:** Axios
- **State Management:** React Context

### Ana Özellikler

#### 1. Dashboard
- **Dosya:** `pages/Dashboard.tsx`
- **Amaç:** Sistem genel durumu görüntüleme
- **Özellikler:**
  - Aktif sürücü sayısı
  - Günlük yolculuk istatistikleri
  - Gelir raporları
  - Sistem sağlık durumu

#### 2. Sürücü Yönetimi
- **Dosya:** `pages/DriversPage.tsx`
- **Amaç:** Sürücü başvurularını yönetme
- **Özellikler:**
  - Başvuru listesi
  - Belge inceleme
  - Onaylama/reddetme
  - Sürücü durumu güncelleme

#### 3. Kullanıcı Yönetimi
- **Dosya:** `pages/UsersPage.tsx`
- **Amaç:** Müşteri hesaplarını yönetme
- **Özellikler:**
  - Kullanıcı listesi
  - Hesap durumu yönetimi
  - Şikayet takibi

#### 4. Fiyatlandırma Yönetimi
- **Dosya:** `pages/PricingPage.tsx`
- **Amaç:** Tarife ve fiyat yönetimi
- **Özellikler:**
  - Bölgesel fiyat ayarları
  - Zam oranları
  - Özel tarife tanımlama

#### 5. Sistem Ayarları
- **Dosya:** `pages/SystemSettingsPage.tsx`
- **Amaç:** Uygulama konfigürasyonu
- **Özellikler:**
  - Genel ayarlar
  - Bildirim ayarları
  - Bakım modu

### Güvenlik ve Kimlik Doğrulama
- **Dosyalar:** `contexts/AuthContext.tsx`, `services/authService.ts`
- **Özellikler:**
  - Admin girişi
  - Role-based access control
  - Session yönetimi
  - Protected routes

### Neden Bu Yapı Seçildi?

1. **React:** Modern, component-based architecture
2. **Material-UI:** Profesyonel görünüm, hızlı geliştirme
3. **Chart Libraries:** Zengin veri görselleştirme
4. **Context API:** Basit state yönetimi
5. **Responsive Design:** Farklı cihazlarda kullanım

---

## 🗄️ DATABASE (Veritabanı)

### Veritabanı Mimarisi

#### Production Environment
- **Platform:** Microsoft SQL Server (Azure SQL Edge)
- **Dosya:** `backend/database/init.sql`
- **Özellikler:**
  - Yüksek performans
  - Otomatik backup
  - Scalability
  - Enterprise güvenlik

#### Development Environment
- **Platform:** SQLite
- **Dosya:** `backend/database/init-sqlite.sql`
- **Özellikler:**
  - Hızlı setup
  - Dosya tabanlı
  - Geliştirici dostu

### Tablo Yapısı ve İlişkiler

#### 1. Kullanıcı Yönetimi
```sql
-- Ana kullanıcı tablosu
users (id, phone_number, first_name, last_name, email, user_type)

-- Kullanıcı adresleri
user_addresses (id, user_id, title, address, latitude, longitude)
```

#### 2. Sürücü Yönetimi
```sql
-- Sürücü bilgileri
drivers (id, user_id, license_number, vehicle_plate, vehicle_model)

-- Sürücü belgeleri
driver_documents (id, driver_id, document_type, file_path)
```

#### 3. Yolculuk Yönetimi
```sql
-- Yolculuk kayıtları
rides (id, customer_id, driver_id, pickup_location, destination)

-- Yolculuk durumu takibi
ride_status_history (id, ride_id, status, timestamp)
```

#### 4. Ödeme Sistemi
```sql
-- Ödeme işlemleri
payments (id, ride_id, amount, payment_method, status)

-- Sürücü kazançları
driver_earnings (id, driver_id, ride_id, amount, commission)
```

### Migration Sistemi
- **Dosyalar:** `backend/migrations/`
- **Amaç:** Veritabanı şema güncellemeleri
- **Özellikler:**
  - Versiyonlu güncellemeler
  - Rollback desteği
  - Otomatik deployment

### Neden Bu Yapı Seçildi?

1. **SQL Server:** Enterprise düzeyde güvenilirlik ve performans
2. **SQLite:** Development kolaylığı
3. **Normalized Design:** Veri tutarlılığı
4. **Indexing:** Hızlı sorgular
5. **Foreign Keys:** Referential integrity

---

## 🔄 ENTEGRASYON VE İLETİŞİM

### API İletişimi
- **REST API:** CRUD işlemleri için
- **Socket.IO:** Gerçek zamanlı güncellemeler
- **JWT Authentication:** Güvenli API erişimi

### Dosya Yönetimi
- **Upload System:** Multer ile güvenli dosya yükleme
- **Storage:** Local storage + cloud backup planı
- **Validation:** Dosya tipi ve boyut kontrolü

### Güvenlik Önlemleri
- **HTTPS:** Tüm iletişimde şifreleme
- **Rate Limiting:** API abuse koruması
- **Input Validation:** Joi ile veri doğrulama
- **CORS:** Cross-origin request kontrolü

---

## 📈 PERFORMANS VE ÖLÇEKLENEBİLİRLİK

### Optimizasyon Stratejileri
1. **Database Indexing:** Hızlı sorgular
2. **Connection Pooling:** Veritabanı bağlantı yönetimi
3. **Caching:** Redis entegrasyonu planı
4. **CDN:** Statik dosyalar için
5. **Load Balancing:** Yüksek trafik için hazırlık

### Monitoring ve Logging
- **Error Tracking:** Hata kayıtları
- **Performance Metrics:** Sistem performansı
- **User Analytics:** Kullanım istatistikleri

---

## 🚀 DEPLOYMENT VE DevOps

### Ortam Yönetimi
- **Development:** Local SQLite + Node.js
- **Staging:** Test ortamı
- **Production:** Azure SQL + Cloud hosting

### CI/CD Pipeline
- **Version Control:** Git
- **Automated Testing:** Jest + React Testing Library
- **Deployment:** Automated deployment scripts

---

## 📋 SONUÇ VE GELECEK PLANLAR

### Mevcut Durum
Proje, tam fonksiyonel bir taksi çağırma uygulaması olarak tamamlanmıştır. Müşteriler taksi çağırabilir, sürücüler başvuru yapabilir ve yöneticiler sistemi yönetebilir.

### Gelecek Geliştirmeler
1. **Push Notifications:** Gerçek zamanlı bildirimler
2. **Payment Gateway:** Kredi kartı entegrasyonu
3. **Analytics Dashboard:** Detaylı raporlama
4. **Mobile App Store:** App Store ve Google Play yayını
5. **Microservices:** Servis tabanlı mimariye geçiş

### Teknik Borç
1. **Test Coverage:** Unit ve integration testleri
2. **Documentation:** API dokümantasyonu
3. **Security Audit:** Güvenlik denetimi
4. **Performance Testing:** Yük testleri

---

*Bu dokümantasyon, YükleGel Taksi projesinin mevcut durumunu ve teknik kararların gerekçelerini açıklamaktadır. Proje sürekli geliştirilmekte olup, bu dokümantasyon da güncel tutulacaktır.*

**Son Güncelleme:** " + new Date().toLocaleDateString('tr-TR') + "
**Versiyon:** 1.0.0