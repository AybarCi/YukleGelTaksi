// Merkezi Environment Configuration Helper
// Bu dosya shared package içinde merkezi config'i sağlar

interface EnvironmentConfig {
  API_HOST: string;
  API_PORT: number;
  SOCKET_PORT: number;
  BASE_URL: string;
  SOCKET_URL: string;
  FILES_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
  GOOGLE_MAPS_API_KEY: string;
  GOOGLE_PLACES_API_KEY_IOS: string;
  GOOGLE_PLACES_API_KEY_ANDROID: string;
}

// Environment variables'ları oku
const getEnvVar = (key: string, defaultValue?: string): string => {
  // Önce process.env kontrol et (Node/Web bundler'lar için)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  // Expo (React Native) ortamında app.json/app.config.ts içindeki extra'dan oku
  try {
    // dynamic require: diğer ortamlarda paketi yüklemeye çalışmaz
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    const extra = (Constants?.expoConfig?.extra ?? Constants?.manifest?.extra) || {};
    const val = extra[key];
    if (typeof val !== 'undefined' && val !== null) {
      return String(val);
    }
  } catch (_) {
    // expo-constants yoksa sessizce devam et
  }
  return defaultValue || '';
};

// Yardımcı: host geçerli bir yerel geliştirme host'u mu?
const isValidLocalDevHost = (host: string): boolean => {
  if (!host) return false;
  const lower = host.toLowerCase();
  // Expo tunneling host'larını ve genel alan adlarını ele
  if (lower.includes('exp.host') || lower.endsWith('expo.dev')) return false;
  // IPv4 private network aralıkları
  if (lower.startsWith('10.') || lower.startsWith('192.168.') || (lower.startsWith('172.') && (() => {
    const parts = lower.split('.');
    const second = parseInt(parts[1], 10);
    return second >= 16 && second <= 31;
  })())) return true;
  // Lokal ana bilgisayar isimleri
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '10.0.2.2') return true;
  return false;
};

// Geliştirme ortamında cihazdan erişilebilen yerel IP'yi tespit etme (Expo için)
const detectDevHost = (): string | undefined => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    const hostUri: string | undefined = Constants?.expoConfig?.hostUri || Constants?.manifest?.hostUri;
    if (hostUri && typeof hostUri === 'string') {
      const match = hostUri.match(/\/\/([^/:]+)/);
      if (match && match[1]) {
        let host = match[1];
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { Platform } = require('react-native');
          if ((host === 'localhost' || host === '127.0.0.1') && Platform?.OS === 'android') {
            // Android emülatörü için özel localhost yönlendirmesi
            host = '10.0.2.2';
          }
        } catch (_) { /* ignore */ }
        if (isValidLocalDevHost(host)) return host;
      }
    }
    // debuggerHost (eski Expo manifest özelliği) üzerinden dene
    const dbgHost: string | undefined = Constants?.manifest?.debuggerHost;
    if (dbgHost && typeof dbgHost === 'string') {
      const host = dbgHost.split(':')[0];
      if (isValidLocalDevHost(host)) return host;
    }
  } catch (_) {
    // expo-constants yoksa Linking üzerinden dene
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Linking = require('expo-linking');
      const url = Linking?.createURL ? Linking.createURL('/') : undefined;
      if (url && typeof url === 'string') {
        const match = url.match(/\/\/([^/:]+)/);
        if (match && match[1]) {
          let host = match[1];
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { Platform } = require('react-native');
            if ((host === 'localhost' || host === '127.0.0.1') && Platform?.OS === 'android') {
              host = '10.0.2.2';
            }
          } catch (_) { /* ignore */ }
          if (isValidLocalDevHost(host)) return host;
        }
      }
    } catch (_) {
      // React Native bundle URL üzerinden fallback: NativeModules.SourceCode.scriptURL
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { NativeModules, Platform } = require('react-native');
        const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
        if (scriptURL && typeof scriptURL === 'string') {
          const match = scriptURL.match(/\/\/([^/:]+)/);
          if (match && match[1]) {
            let host = match[1];
            if ((host === 'localhost' || host === '127.0.0.1') && Platform?.OS === 'android') {
              host = '10.0.2.2';
            }
            if (isValidLocalDevHost(host)) return host;
          }
        }
      } catch (_) {
        // yoksa sessizce geç
      }
    }
  }
  return undefined;
};

// Merkezi konfigürasyon
const rawApiHost = getEnvVar('API_HOST', '');
const autoDetectedHost = detectDevHost();

// Manuel IP adresi ayarı - development ortamı için
const MANUAL_DEV_HOST = '192.168.1.13';

export const ENV_CONFIG: EnvironmentConfig = {
  // API_HOST: Eğer 'auto' veya boş ise otomatik tespit edilen host'u kullan, aksi halde verilen değeri kullan
  // Manuel IP adresi development ortamı için önceliklidir
  API_HOST: MANUAL_DEV_HOST || (rawApiHost && rawApiHost !== 'auto' ? rawApiHost : (autoDetectedHost || 'localhost')),
  API_PORT: parseInt(getEnvVar('API_PORT', '3000')),
  SOCKET_PORT: parseInt(getEnvVar('SOCKET_PORT', '3000')),
  NODE_ENV: (getEnvVar('NODE_ENV', 'development') as 'development' | 'production' | 'test'),
  GOOGLE_MAPS_API_KEY: getEnvVar('GOOGLE_MAPS_API_KEY', 'AIzaSyCrQmf3XUB_QRY4jkxQqIbRUbYAVkhyHHA'),
  GOOGLE_PLACES_API_KEY_IOS: getEnvVar('GOOGLE_PLACES_API_KEY_IOS', 'AIzaSyCrQmf3XUB_QRY4jkxQqIbRUbYAVkhyHHA'),
  GOOGLE_PLACES_API_KEY_ANDROID: getEnvVar('GOOGLE_PLACES_API_KEY_ANDROID', 'AIzaSyBDEJcd7kMGnzjUh4fDaP5ZFCct_9w0Pqw'),
  
  // Dinamik URL'ler
  get BASE_URL() {
    if (this.NODE_ENV === 'production') {
      return getEnvVar('PROD_API_URL', 'https://yuklegeltaksiapi.istekbilisim.com');
    }
    return `http://${this.API_HOST}:${this.API_PORT}`;
  },
  
  get SOCKET_URL() {
    if (this.NODE_ENV === 'production') {
      return getEnvVar('PROD_SOCKET_URL', 'https://yuklegeltaksiapi.istekbilisim.com');
    }
    // Development ortamında SOCKET_PORT kullanılmalı
    return `http://${this.API_HOST}:${this.SOCKET_PORT}`;
  },
  
  get FILES_URL() {
    return `${this.BASE_URL}/api/files`;
  }
};

// Backward compatibility için eski API_CONFIG formatı
export const API_CONFIG = {
  get BASE_URL() { return ENV_CONFIG.BASE_URL; },
  get FILES_URL() { return ENV_CONFIG.FILES_URL; },
  get SOCKET_URL() { return ENV_CONFIG.SOCKET_URL; },
  get GOOGLE_MAPS_API_KEY() { return ENV_CONFIG.GOOGLE_MAPS_API_KEY; },
  get GOOGLE_PLACES_API_KEY_IOS() { return ENV_CONFIG.GOOGLE_PLACES_API_KEY_IOS; },
  get GOOGLE_PLACES_API_KEY_ANDROID() { return ENV_CONFIG.GOOGLE_PLACES_API_KEY_ANDROID; },
  TIMEOUT: 10000,
};

export default ENV_CONFIG;