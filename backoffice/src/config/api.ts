// Backoffice API konfigürasyonu - Environment değişkenlerinden alınıyor
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  return process.env[`REACT_APP_${key}`] || defaultValue;
};

export const API_CONFIG = {
  get BASE_URL() { 
    const host = getEnvVar('API_HOST', 'localhost');
    const port = getEnvVar('API_PORT', '3000');
    return `http://${host}:${port}/api`;
  },
  get FILES_URL() { 
    const host = getEnvVar('API_HOST', 'localhost');
    const port = getEnvVar('API_PORT', '3000');
    return `http://${host}:${port}/api/files`;
  },
  get SOCKET_URL() { 
    const host = getEnvVar('API_HOST', 'localhost');
    const port = getEnvVar('SOCKET_PORT', '3001');
    return `ws://${host}:${port}`;
  },
  get GOOGLE_MAPS_API_KEY() { 
    return getEnvVar('GOOGLE_MAPS_API_KEY', '');
  },
};

export const getImageUrl = (imageUrl: string | null | undefined): string => {
  if (!imageUrl) return '';
  
  // If it's already a full URL, return as is
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // For cargo type and vehicle type images (saved in public/uploads/)
  if (imageUrl.includes('/uploads/')) {
    // Derive origin from FILES_URL: http://host:port/api/files -> http://host:port
    const filesUrl = API_CONFIG.FILES_URL;
    const origin = filesUrl.replace('/api/files', '');
    return `${origin}${imageUrl}`;
  }
  
  // For driver photos and other files served via /api/files/
  return `${API_CONFIG.FILES_URL}/${imageUrl}`;
};

export default API_CONFIG;