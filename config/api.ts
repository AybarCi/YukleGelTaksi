// Import shared merkezi konfigürasyon
import { API_CONFIG as SHARED_API_CONFIG } from '../packages/shared/src/config/environment';

// Root API konfigürasyonu - Shared config'den alınıyor
export const API_CONFIG = {
  get BASE_URL() { return SHARED_API_CONFIG.BASE_URL; },
  get FILES_URL() { return SHARED_API_CONFIG.FILES_URL; },
  get SOCKET_URL() { return SHARED_API_CONFIG.SOCKET_URL; },
  get GOOGLE_MAPS_API_KEY() { return SHARED_API_CONFIG.GOOGLE_MAPS_API_KEY; },
  get GOOGLE_PLACES_API_KEY() { return SHARED_API_CONFIG.GOOGLE_MAPS_API_KEY; },
};

export default API_CONFIG;