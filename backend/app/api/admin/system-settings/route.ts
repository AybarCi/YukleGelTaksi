import { NextRequest, NextResponse } from 'next/server';
import * as Joi from 'joi';
import sql, { Transaction } from 'mssql';
import DatabaseConnection from '../../../../config/database';
import { authenticateSupervisorToken } from '../../../../middleware/supervisorAuth';
import { validateRequest } from '../../../../middleware/validation';
import SystemSettingsService from '../../../../services/systemSettingsService';

// OPTIONS - CORS preflight istekleri için
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// GET - Tüm sistem ayarlarını getir
export async function GET(request: NextRequest) {
  try {
    // Supervisor token doğrulama
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    // Supervisor kontrolü (isteğe bağlı - şimdilik tüm authenticated supervisor'lar erişebilir)
    // if (authResult.supervisor.role !== 'admin') {
    //   return NextResponse.json(
    //     { error: 'Bu işlem için admin yetkisi gereklidir' },
    //     { status: 403 }
    //   );
    // }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // URL parametrelerini al
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const active_only = searchParams.get('active_only') === 'true';

    let query = `
      SELECT 
        id,
        setting_key,
        setting_value,
        setting_type,
        description,
        category,
        is_active,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM system_settings
      WHERE 1=1
    `;

    const queryRequest = pool.request();

    if (category) {
      query += ' AND category = @category';
      queryRequest.input('category', category);
    }

    if (active_only) {
      query += ' AND is_active = 1';
    }

    query += ' ORDER BY category, setting_key';

    const result = await queryRequest.query(query);

    // Değerleri tip dönüşümü ile döndür
    const settings = result.recordset.map((setting: any) => {
      let parsedValue = setting.setting_value;
      
      // Tip dönüşümü
      switch (setting.setting_type) {
        case 'number':
          parsedValue = parseFloat(setting.setting_value);
          break;
        case 'boolean':
          parsedValue = setting.setting_value.toLowerCase() === 'true';
          break;
        case 'json':
          try {
            parsedValue = JSON.parse(setting.setting_value);
          } catch (e) {
            parsedValue = setting.setting_value;
          }
          break;
        default:
          parsedValue = setting.setting_value;
      }

      return {
        ...setting,
        parsed_value: parsedValue
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Sistem ayarları başarıyla getirildi',
      settings
    });

  } catch (error) {
    console.error('Sistem ayarları getirme hatası:', error);
    return NextResponse.json(
      { error: 'Sistem ayarları getirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

// PUT - Sistem ayarlarını güncelle
export async function PUT(request: NextRequest) {
  let transaction: Transaction | null = null;
  
  try {
    // Supervisor token doğrulama
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    // İstek doğrulama
    const systemSettingsUpdateSchema = Joi.object({
      settings: Joi.array().items(
        Joi.object({
          setting_key: Joi.string().required(),
          setting_value: Joi.string().required(),
          setting_type: Joi.string().valid('string', 'number', 'boolean', 'json').default('string'),
          description: Joi.string().allow('', null),
          category: Joi.string().default('general'),
          is_active: Joi.boolean().default(true)
        })
      ).required().min(1)
    });

    const validationResult = await validateRequest(request, systemSettingsUpdateSchema);
    if (!validationResult.isValid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.errors },
        { status: 400 }
      );
    }

    const { settings } = validationResult.data;
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Transaction başlat
    transaction = new Transaction(pool);
    await transaction.begin();

    try {
      const updatedSettings = [];

      for (const setting of settings) {
        // Ayarın var olup olmadığını kontrol et
        const existingResult = await transaction.request()
          .input('setting_key', setting.setting_key)
          .query('SELECT id FROM system_settings WHERE setting_key = @setting_key');

        if (existingResult.recordset.length > 0) {
          // Güncelle
          await transaction.request()
            .input('setting_key', setting.setting_key)
            .input('setting_value', setting.setting_value)
            .input('setting_type', setting.setting_type)
            .input('description', setting.description)
            .input('category', setting.category)
            .input('is_active', setting.is_active)
            .input('updated_by', authResult.supervisor.username || authResult.supervisor.id.toString())
            .query(`
              UPDATE system_settings 
              SET 
                setting_value = @setting_value,
                setting_type = @setting_type,
                description = @description,
                category = @category,
                is_active = @is_active,
                updated_at = GETDATE(),
                updated_by = @updated_by
              WHERE setting_key = @setting_key
            `);
        } else {
          // Yeni kayıt ekle
          await transaction.request()
            .input('setting_key', setting.setting_key)
            .input('setting_value', setting.setting_value)
            .input('setting_type', setting.setting_type)
            .input('description', setting.description)
            .input('category', setting.category)
            .input('is_active', setting.is_active)
            .input('created_by', authResult.supervisor.username || authResult.supervisor.id.toString())
            .input('updated_by', authResult.supervisor.username || authResult.supervisor.id.toString())
            .query(`
              INSERT INTO system_settings 
              (setting_key, setting_value, setting_type, description, category, is_active, created_by, updated_by)
              VALUES 
              (@setting_key, @setting_value, @setting_type, @description, @category, @is_active, @created_by, @updated_by)
            `);
        }

        updatedSettings.push(setting.setting_key);
      }

      await transaction.commit();

      // Sistem ayarları güncellendiğinde önbelleği temizle
      SystemSettingsService.clearStaticCache();

      return NextResponse.json({
        success: true,
        message: `${updatedSettings.length} sistem ayarı başarıyla güncellendi`,
        updated_settings: updatedSettings
      });

    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }
      throw error;
    }

  } catch (error) {
    console.error('Sistem ayarları güncelleme hatası:', error);
    return NextResponse.json(
      { error: 'Sistem ayarları güncellenirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

// POST - Yeni sistem ayarı ekle
export async function POST(request: NextRequest) {
  try {
    // Supervisor token doğrulama
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    // İstek doğrulama
    const systemSettingCreateSchema = Joi.object({
      setting_key: Joi.string().required(),
      setting_value: Joi.string().required(),
      setting_type: Joi.string().valid('string', 'number', 'boolean', 'json').default('string'),
      description: Joi.string().allow('', null),
      category: Joi.string().default('general'),
      is_active: Joi.boolean().default(true)
    });

    const validationResult = await validateRequest(request, systemSettingCreateSchema);
    if (!validationResult.isValid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.errors },
        { status: 400 }
      );
    }

    const { setting_key, setting_value, setting_type, description, category, is_active } = validationResult.data;
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Aynı key'in var olup olmadığını kontrol et
    const existingResult = await pool.request()
      .input('setting_key', setting_key)
      .query('SELECT id FROM system_settings WHERE setting_key = @setting_key');

    if (existingResult.recordset.length > 0) {
      return NextResponse.json(
        { error: 'Bu ayar anahtarı zaten mevcut' },
        { status: 409 }
      );
    }

    // Yeni ayar ekle
    await pool.request()
      .input('setting_key', setting_key)
      .input('setting_value', setting_value)
      .input('setting_type', setting_type)
      .input('description', description)
      .input('category', category)
      .input('is_active', is_active)
      .input('created_by', authResult.supervisor.username || authResult.supervisor.id.toString())
      .input('updated_by', authResult.supervisor.username || authResult.supervisor.id.toString())
      .query(`
        INSERT INTO system_settings 
        (setting_key, setting_value, setting_type, description, category, is_active, created_by, updated_by)
        VALUES 
        (@setting_key, @setting_value, @setting_type, @description, @category, @is_active, @created_by, @updated_by)
      `);

    // Yeni sistem ayarı eklendiğinde önbelleği temizle
    SystemSettingsService.clearStaticCache();

    return NextResponse.json({
      success: true,
      message: 'Sistem ayarı başarıyla eklendi',
      setting_key
    });

  } catch (error) {
    console.error('Sistem ayarı ekleme hatası:', error);
    return NextResponse.json(
      { error: 'Sistem ayarı eklenirken bir hata oluştu' },
      { status: 500 }
    );
  }
}