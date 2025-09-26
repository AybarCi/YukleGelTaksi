// Backoffice API konfigürasyonu - Environment değişkenlerinden alınıyor
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  return process.env[`REACT_APP_${key}`] || defaultValue;
};

export const API_CONFIG = {
  get BASE_URL() { 
    const host = getEnvVar('API_HOST', '192.168.1.134');
    const port = getEnvVar('API_PORT', '3000');
    return `http://${host}:${port}/api`;
  },
  get FILES_URL() { 
    const host = getEnvVar('API_HOST', '192.168.1.134');
    const port = getEnvVar('API_PORT', '3000');
    return `http://${host}:${port}/api/files`;
  },
  get SOCKET_URL() { 
    const host = getEnvVar('API_HOST', '192.168.1.134');
    const port = getEnvVar('SOCKET_PORT', '3001');
    return `ws://${host}:${port}`;
  },
  get GOOGLE_MAPS_API_KEY() { 
    return getEnvVar('GOOGLE_MAPS_API_KEY', '');
  },
};

export default API_CONFIG;