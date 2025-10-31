import { API_CONFIG } from '../config/api';

class SystemSettingsService {
  private static instance: SystemSettingsService;
  private laborPriceCache: number | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

  private constructor() {}

  public static getInstance(): SystemSettingsService {
    if (!SystemSettingsService.instance) {
      SystemSettingsService.instance = new SystemSettingsService();
    }
    return SystemSettingsService.instance;
  }

  /**
   * Hammaliye ücretini backend'den alır (cache ile)
   */
  public async getLaborPrice(): Promise<number> {
    // Cache kontrolü
    if (this.laborPriceCache && Date.now() < this.cacheExpiry) {
      return this.laborPriceCache;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/system-settings/labor-price`);
      const data = await response.json();

      if (data.success && data.laborPrice) {
        this.laborPriceCache = data.laborPrice;
        this.cacheExpiry = Date.now() + this.CACHE_DURATION;
        return data.laborPrice;
      }

      // Hata durumunda varsayılan değer
      return 25;
    } catch (error) {
      console.error('Hammaliye fiyatı alınırken hata:', error);
      return 25; // Varsayılan değer
    }
  }

  /**
   * Cache'i temizler
   */
  public clearCache(): void {
    this.laborPriceCache = null;
    this.cacheExpiry = 0;
  }
}

export default SystemSettingsService;