// Merkezi API konfigürasyonu
export const API_CONFIG = {
  BASE_URL: 'http://192.168.1.134:3000',
  FILES_URL: 'http://192.168.1.134:3000/api/files',
  GOOGLE_MAPS_API_KEY: 'AIzaSyBGef-5-FTZhZJQn7Jh8c6vHQvQvHQvQvH',
  GOOGLE_PLACES_API_KEY: 'AIzaSyBGef-5-FTZhZJQn7Jh8c6vHQvQvHQvQvH'
};

// Development ortamı için
if (process.env.NODE_ENV === 'development') {
  API_CONFIG.BASE_URL = 'http://192.168.1.134:3000';
  API_CONFIG.FILES_URL = 'http://192.168.1.134:3000/api/files';
} else if (process.env.NODE_ENV === 'production') {
  // Production için domain
  API_CONFIG.BASE_URL = 'https://api.yuklegeltaksi.com';
  API_CONFIG.FILES_URL = 'https://api.yuklegeltaksi.com/api/files';
}

export default API_CONFIG;