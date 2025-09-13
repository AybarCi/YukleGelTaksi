# YukleGel Taksi Monorepo

YukleGel Taksi uygulaması için monorepo yapısı. Bu proje müşteri ve sürücü uygulamalarını, paylaşılan kütüphaneyi ve backend servislerini içerir.

## Proje Yapısı

```
YukleGelTaksi/
├── packages/
│   ├── shared/                 # Paylaşılan kütüphane
│   │   ├── src/
│   │   │   ├── types/         # TypeScript tip tanımları
│   │   │   ├── services/      # API servisleri
│   │   │   ├── utils/         # Yardımcı fonksiyonlar
│   │   │   ├── constants/     # Sabitler
│   │   │   └── index.ts       # Ana export dosyası
│   │   └── package.json
│   ├── customer-app/          # Müşteri uygulaması
│   │   ├── app/              # Expo Router sayfaları
│   │   ├── components/       # React bileşenleri
│   │   ├── assets/           # Görseller ve diğer varlıklar
│   │   ├── app.json          # Expo konfigürasyonu
│   │   └── package.json
│   └── driver-app/           # Sürücü uygulaması
│       ├── app/              # Expo Router sayfaları
│       ├── components/       # React bileşenleri
│       ├── assets/           # Görseller ve diğer varlıklar
│       ├── app.json          # Expo konfigürasyonu
│       └── package.json
├── backend/                   # Backend servisleri
└── package.json              # Root package.json
```

## Kurulum

### Gereksinimler

- Node.js >= 18.0.0
- npm >= 8.0.0
- Expo CLI
- React Native development environment

### Tüm Bağımlılıkları Yükleme

```bash
npm run install:all
```

## Geliştirme

### Müşteri Uygulamasını Çalıştırma

```bash
npm run dev:customer
```

### Sürücü Uygulamasını Çalıştırma

```bash
npm run dev:driver
```

### Backend Servisini Çalıştırma

```bash
npm run start:backend
```

## Build İşlemleri

### Tüm Projeleri Build Etme

```bash
npm run build:all
```

### Sadece Paylaşılan Kütüphaneyi Build Etme

```bash
npm run build:shared
```

### Sadece Müşteri Uygulamasını Build Etme

```bash
npm run build:customer
```

### Sadece Sürücü Uygulamasını Build Etme

```bash
npm run build:driver
```

## Test ve Linting

### Tüm Testleri Çalıştırma

```bash
npm run test:all
```

### Linting

```bash
npm run lint:all
```

## Temizlik İşlemleri

### Node Modules ve Build Dosyalarını Temizleme

```bash
npm run clean
```

### Temizlik Yapıp Yeniden Kurulum

```bash
npm run reset
```

## Özellikler

### Paylaşılan Kütüphane
- TypeScript tip tanımları
- API servisleri
- Yardımcı fonksiyonlar
- Sabitler

### Müşteri Uygulaması
- Kullanıcı kaydı ve girişi
- Taksi çağırma
- Seyahat geçmişi
- Profil yönetimi
- Destek sistemi

### Sürücü Uygulaması
- Sürücü kaydı ve girişi
- Seyahat kabul etme
- Navigasyon
- Kazanç takibi
- Profil yönetimi

## Teknolojiler

- **React Native**: Mobil uygulama geliştirme
- **Expo**: React Native geliştirme platformu
- **TypeScript**: Tip güvenliği
- **Expo Router**: Navigasyon
- **React Native Maps**: Harita entegrasyonu
- **Socket.io**: Gerçek zamanlı iletişim

## Lisans

MIT