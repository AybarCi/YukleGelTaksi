// Import merkezi konfigürasyon
import { API_CONFIG as CENTRAL_API_CONFIG } from '../config/environment';

// API Configuration - Merkezi config'den alınıyor
export const API_CONFIG = {
  get BASE_URL() { return CENTRAL_API_CONFIG.BASE_URL; },
  get SOCKET_URL() { return CENTRAL_API_CONFIG.SOCKET_URL; },
  get FILES_URL() { return CENTRAL_API_CONFIG.FILES_URL; },
  TIMEOUT: 10000,
};

// Map Configuration
export const MAP_CONFIG = {
  DEFAULT_REGION: {
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  },
  ZOOM_LEVELS: {
    CITY: 0.1,
    DISTRICT: 0.05,
    STREET: 0.01,
    BUILDING: 0.005,
  },
};

// Ride Configuration
export const RIDE_CONFIG = {
  SEARCH_RADIUS: 5, // km
  MAX_WAIT_TIME: 300, // seconds
  PRICE_PER_KM: 2.5, // TL
  BASE_PRICE: 5.0, // TL
  MINIMUM_FARE: 10.0, // TL
};

// Driver Configuration
export const DRIVER_CONFIG = {
  LOCATION_UPDATE_INTERVAL: 5000, // ms
  OFFLINE_TIMEOUT: 30000, // ms
  MAX_DISTANCE_FROM_PICKUP: 10, // km
};

// Customer Configuration
export const CUSTOMER_CONFIG = {
  LOCATION_UPDATE_INTERVAL: 10000, // ms
  RIDE_SEARCH_TIMEOUT: 60000, // ms
};

// Socket Events
export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  
  // Driver Events
  DRIVER_CONNECT: 'driver_connect',
  DRIVER_DISCONNECT: 'driver_disconnect',
  LOCATION_UPDATE: 'location_update',
  AVAILABILITY_UPDATE: 'availability_update',
  RIDE_ACCEPT: 'ride_accept',
  RIDE_STATUS_UPDATE: 'ride_status_update',
  
  // Customer Events
  CUSTOMER_CONNECT: 'customer_connect',
  CUSTOMER_DISCONNECT: 'customer_disconnect',
  CUSTOMER_LOCATION_UPDATE: 'customer_location_update',
  RIDE_REQUEST: 'ride_request',
  RIDE_CANCEL: 'ride_cancel',
  
  // Broadcast Events
  NEARBY_DRIVERS_UPDATE: 'nearbyDriversUpdate',
  RIDE_UPDATE: 'rideUpdate',
  DRIVER_LOCATION_UPDATE: 'driverLocationUpdate',
};

// Storage Keys
export const STORAGE_KEYS = {
  USER_TOKEN: 'user_token',
  USER_DATA: 'user_data',
  USER_TYPE: 'user_type',
  LAST_LOCATION: 'last_location',
  RIDE_HISTORY: 'ride_history',
  SETTINGS: 'settings',
};

// Colors
export const COLORS = {
  PRIMARY: '#007AFF',
  SECONDARY: '#5856D6',
  SUCCESS: '#34C759',
  WARNING: '#FF9500',
  ERROR: '#FF3B30',
  INFO: '#5AC8FA',
  
  // Grayscale
  BLACK: '#000000',
  DARK_GRAY: '#1C1C1E',
  GRAY: '#8E8E93',
  LIGHT_GRAY: '#C7C7CC',
  WHITE: '#FFFFFF',
  
  // Background
  BACKGROUND: '#F2F2F7',
  CARD_BACKGROUND: '#FFFFFF',
  
  // Text
  TEXT_PRIMARY: '#000000',
  TEXT_SECONDARY: '#3C3C43',
  TEXT_TERTIARY: '#8E8E93',
};

// Typography
export const TYPOGRAPHY = {
  SIZES: {
    SMALL: 12,
    MEDIUM: 16,
    LARGE: 20,
    XLARGE: 24,
    XXLARGE: 32,
  },
  WEIGHTS: {
    LIGHT: '300' as const,
    REGULAR: '400' as const,
    MEDIUM: '500' as const,
    SEMIBOLD: '600' as const,
    BOLD: '700' as const,
  },
};

// Spacing
export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 32,
  XXL: 48,
};

// Border Radius
export const BORDER_RADIUS = {
  SM: 4,
  MD: 8,
  LG: 12,
  XL: 16,
  ROUND: 50,
};

// Animation Durations
export const ANIMATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Ağ bağlantısı hatası',
  LOCATION_PERMISSION: 'Konum izni gerekli',
  LOCATION_UNAVAILABLE: 'Konum bilgisi alınamadı',
  RIDE_NOT_FOUND: 'Yolculuk bulunamadı',
  DRIVER_NOT_FOUND: 'Sürücü bulunamadı',
  INVALID_CREDENTIALS: 'Geçersiz kullanıcı bilgileri',
  SERVER_ERROR: 'Sunucu hatası',
  TIMEOUT_ERROR: 'İstek zaman aşımına uğradı',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  RIDE_CREATED: 'Yolculuk talebi oluşturuldu',
  RIDE_ACCEPTED: 'Yolculuk kabul edildi',
  RIDE_COMPLETED: 'Yolculuk tamamlandı',
  PROFILE_UPDATED: 'Profil güncellendi',
  LOCATION_UPDATED: 'Konum güncellendi',
};

// Validation Rules
export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^(\+90|0)?[5][0-9]{9}$/,
  PASSWORD_MIN_LENGTH: 6,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
};