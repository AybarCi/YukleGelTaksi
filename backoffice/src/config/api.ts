// Backoffice API konfigürasyonu - Environment değişkenlerinden alınıyor
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  return process.env[`REACT_APP_${key}`] || defaultValue;
};

const getBaseUrl = (): string => {
  // Her iki ortamda da yuklegeltaksiapi.istekbilisim.com kullan
  return 'https://yuklegeltaksiapi.istekbilisim.com/api';
};

const getFilesUrl = (): string => {
  // Her iki ortamda da yuklegeltaksiapi.istekbilisim.com kullan
  return 'https://yuklegeltaksiapi.istekbilisim.com/api/files';
};

const getSocketUrl = (): string => {
  // Her iki ortamda da yuklegeltaksiapi.istekbilisim.com kullan (wss protokolü ile)
  return 'wss://yuklegeltaksiapi.istekbilisim.com';
};

const getGoogleMapsApiKey = (): string => {
  return getEnvVar('GOOGLE_MAPS_API_KEY', '');
};

export const API_CONFIG = {
  BASE_URL: getBaseUrl(),
  FILES_URL: getFilesUrl(),
  SOCKET_URL: getSocketUrl(),
  GOOGLE_MAPS_API_KEY: getGoogleMapsApiKey(),
};

export const getImageUrl = (imageUrl: string | null | undefined): string => {
  if (!imageUrl) return '';
  
  // If it's already a full URL, return as is
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // /uploads/ ile başlayan yollar için yeni yapıya göre çevir
  if (imageUrl.startsWith('/uploads/')) {
    // /uploads/vehicle-type-photos/... -> /api/files/vehicle-type-photos/...
    // /uploads/cargo-type-photos/... -> /api/files/cargo-type-photos/...
    const newPath = imageUrl.replace('/uploads/', '/api/files/');
    const url = new URL(API_CONFIG.FILES_URL);
    return `${url.origin}${newPath}`;
  }
  
  // For driver photos and other files served via /api/files/
  return `${API_CONFIG.FILES_URL}/${imageUrl}`;
};

export default API_CONFIG;