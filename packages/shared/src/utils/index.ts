import { Location } from '../types';

// Distance calculation using Haversine formula
export function calculateDistance(
  point1: Location,
  point2: Location
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(point2.latitude - point1.latitude);
  const dLon = toRadians(point2.longitude - point1.longitude);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.latitude)) *
      Math.cos(toRadians(point2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Format distance for display
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
}

// Format duration for display
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} dk`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours}s ${remainingMinutes}dk`;
}

// Format currency
export function formatCurrency(amount: number): string {
  return `₺${amount.toFixed(2)}`;
}

// Validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone number (Turkish format)
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^(\+90|0)?[5][0-9]{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

// Generate unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Format date for display
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Get relative time (e.g., "2 minutes ago")
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Az önce';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} dakika önce`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} saat önce`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} gün önce`;
  }

  return formatDate(date);
}

// Storage helpers
export const storage = {
  set: async (key: string, value: any): Promise<void> => {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },

  get: async <T>(key: string): Promise<T | null> => {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },

  remove: async (key: string): Promise<void> => {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  },

  clear: async (): Promise<void> => {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  },
};