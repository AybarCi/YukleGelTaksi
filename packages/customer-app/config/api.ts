// Merkezi API konfigürasyonu
export const API_CONFIG = {
  BASE_URL: 'http://192.168.1.134:3000',
  FILES_URL: 'http://192.168.1.134:3000/api/files',
  GOOGLE_PLACES_API_KEY_IOS: 'AIzaSyCrQmf3XUB_QRY4jkxQqIbRUbYAVkhyHHA',
  GOOGLE_PLACES_API_KEY_ANDROID: 'AIzaSyBDEJcd7kMGnzjUh4fDaP5ZFCct_9w0Pqw',
  GOOGLE_MAPS_API_KEY: 'AIzaSyCrQmf3XUB_QRY4jkxQqIbRUbYAVkhyHHA' // Directions API için
};

// Environment'a göre URL'leri ayarla
if (process.env.NODE_ENV === 'development') {
  // Development için local IP
  API_CONFIG.BASE_URL = 'http://192.168.1.134:3000';
  API_CONFIG.FILES_URL = 'http://192.168.1.134:3000/api/files';
} else if (process.env.NODE_ENV === 'production') {
  // Production için domain
  API_CONFIG.BASE_URL = 'https://api.yuklegeltaksi.com';
  API_CONFIG.FILES_URL = 'https://api.yuklegeltaksi.com/api/files';
}

export default API_CONFIG;