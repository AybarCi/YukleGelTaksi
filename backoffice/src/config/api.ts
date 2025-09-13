// Backoffice API konfigürasyonu
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://192.168.1.12:3000',
  FILES_URL: process.env.REACT_APP_FILES_URL || 'http://192.168.1.12:3000/api/files'
};

export default API_CONFIG;