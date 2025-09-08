import DatabaseConnection from '../config/database.js';

interface SystemSetting {
  setting_key: string;
  setting_value: string;
  setting_type: string;
}

class SystemSettingsService {
  private static instance: SystemSettingsService;
  private static cache: Map<string, any> = new Map();
  private static cacheExpiry: Map<string, number> = new Map();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

  private constructor() {}

  public static getInstance(): SystemSettingsService {
    if (!SystemSettingsService.instance) {
      SystemSettingsService.instance = new SystemSettingsService();
    }
    return SystemSettingsService.instance;
  }

  /**
   * Sistem ayarını çeker (önce cache'den, yoksa veritabanından)
   */
  public async getSetting(key: string, defaultValue?: any): Promise<any> {
    // Cache kontrolü
    if (SystemSettingsService.cache.has(key) && SystemSettingsService.cacheExpiry.has(key)) {
      const expiry = SystemSettingsService.cacheExpiry.get(key)!;
      if (Date.now() < expiry) {
        return SystemSettingsService.cache.get(key);
      }
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      const result = await pool.request()
        .input('setting_key', key)
        .query(`
          SELECT setting_value, setting_type 
          FROM system_settings 
          WHERE setting_key = @setting_key AND is_active = 1
        `);

      if (result.recordset.length > 0) {
        const setting = result.recordset[0];
        const value = SystemSettingsService.parseValue(setting.setting_value, setting.setting_type);
        
        // Cache'e kaydet
        SystemSettingsService.cache.set(key, value);
        SystemSettingsService.cacheExpiry.set(key, Date.now() + SystemSettingsService.CACHE_DURATION);
        
        return value;
      }

      return defaultValue;
    } catch (error) {
      console.error(`Error getting system setting ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Birden fazla sistem ayarını çeker
   */
  public async getSettings(keys: string[]): Promise<Record<string, any>> {
    const settings: Record<string, any> = {};
    
    for (const key of keys) {
      settings[key] = await this.getSetting(key);
    }
    
    return settings;
  }

  /**
   * Sürücü yönetimi ile ilgili tüm ayarları çeker
   */
  public async getDriverManagementSettings(): Promise<{
    searchRadiusKm: number;
    maxDriversPerRequest: number;
    locationUpdateIntervalMinutes: number;
    customerLocationChangeThresholdMeters: number;
  }> {
    const settings = await this.getSettings([
      'driver_search_radius_km',
      'max_drivers_per_request', 
      'driver_location_update_interval_minutes',
      'customer_location_change_threshold_meters'
    ]);

    return {
      searchRadiusKm: settings.driver_search_radius_km || 5,
      maxDriversPerRequest: settings.max_drivers_per_request || 20,
      locationUpdateIntervalMinutes: settings.driver_location_update_interval_minutes || 10,
      customerLocationChangeThresholdMeters: settings.customer_location_change_threshold_meters || 100
    };
  }

  /**
   * Hammaliye fiyatını pricing_settings tablosundan çeker
   */
  public async getLaborPricePerPerson(): Promise<number> {
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      const result = await pool.request()
        .query(`
          SELECT labor_price 
          FROM pricing_settings 
          ORDER BY id DESC
        `);

      if (result.recordset.length > 0) {
        return parseFloat(result.recordset[0].labor_price) || 25;
      }

      return 25; // Varsayılan değer
    } catch (error) {
      console.error('Error getting labor price from pricing_settings:', error);
      return 800; // Hata durumunda varsayılan değer
    }
  }

  /**
   * Cache'i temizler
   */
  public clearCache(key?: string): void {
    if (key) {
      SystemSettingsService.cache.delete(key);
      SystemSettingsService.cacheExpiry.delete(key);
    } else {
      SystemSettingsService.cache.clear();
      SystemSettingsService.cacheExpiry.clear();
    }
  }

  /**
   * Ayar değerini tipine göre ayrıştır
   */
  private static parseValue(value: string, type: string): any {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'json':
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      default:
        return value;
    }
  }

  /**
   * Önbelleği temizle
   */
  public static clearStaticCache(): void {
    SystemSettingsService.cache = new Map();
    SystemSettingsService.cacheExpiry = new Map();
  }
}

export default SystemSettingsService;