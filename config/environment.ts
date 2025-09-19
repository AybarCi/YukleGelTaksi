// Merkezi Environment Configuration Helper
// Bu dosya tüm projeler tarafından import edilecek

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
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue || '';
  }
  return defaultValue || '';
};

// Merkezi konfigürasyon
export const ENV_CONFIG: EnvironmentConfig = {
  API_HOST: getEnvVar('API_HOST', '192.168.1.134'),
  API_PORT: parseInt(getEnvVar('API_PORT', '3000')),
  SOCKET_PORT: parseInt(getEnvVar('SOCKET_PORT', '3001')),
  NODE_ENV: (getEnvVar('NODE_ENV', 'development') as 'development' | 'production' | 'test'),
  GOOGLE_MAPS_API_KEY: getEnvVar('GOOGLE_MAPS_API_KEY', 'AIzaSyCrQmf3XUB_QRY4jkxQqIbRUbYAVkhyHHA'),
  GOOGLE_PLACES_API_KEY_IOS: getEnvVar('GOOGLE_PLACES_API_KEY_IOS', 'AIzaSyCrQmf3XUB_QRY4jkxQqIbRUbYAVkhyHHA'),
  GOOGLE_PLACES_API_KEY_ANDROID: getEnvVar('GOOGLE_PLACES_API_KEY_ANDROID', 'AIzaSyBDEJcd7kMGnzjUh4fDaP5ZFCct_9w0Pqw'),
  
  // Dinamik URL'ler
  get BASE_URL() {
    if (this.NODE_ENV === 'production') {
      return getEnvVar('PROD_API_URL', 'https://api.yuklegeltaksi.com');
    }
    return `http://${this.API_HOST}:${this.API_PORT}`;
  },
  
  get SOCKET_URL() {
    if (this.NODE_ENV === 'production') {
      return getEnvVar('PROD_SOCKET_URL', 'https://socket.yuklegeltaksi.com');
    }
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