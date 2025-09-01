import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '../../../../middleware/auth';
import sql from 'mssql';
import DatabaseConnection from '../../../../config/database';
import * as Joi from 'joi';

// Validation schema for settings update
const settingsUpdateSchema = Joi.object({
  notifications_enabled: Joi.boolean().optional(),
  sound_enabled: Joi.boolean().optional(),
  vibration_enabled: Joi.boolean().optional(),
  marketing_enabled: Joi.boolean().optional(),
  location_enabled: Joi.boolean().optional()
});

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    // Get user ID from authenticated user
    const userId = authResult.user.id;

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    // Get customer settings
    const settingsResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT 
          notifications_enabled,
          sound_enabled,
          vibration_enabled,
          marketing_enabled,
          location_enabled,
          created_at,
          updated_at
        FROM customer_settings 
        WHERE user_id = @userId
      `);

    let settings;
    if (settingsResult.recordset.length === 0) {
      // Create default settings if not exists
      await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          INSERT INTO customer_settings (user_id, notifications_enabled, sound_enabled, vibration_enabled, marketing_enabled, location_enabled)
          VALUES (@userId, 1, 1, 1, 1, 1)
        `);
      
      settings = {
        notifications_enabled: true,
        sound_enabled: true,
        vibration_enabled: true,
        marketing_enabled: true,
        location_enabled: true
      };
    } else {
      const settingsData = settingsResult.recordset[0];
      settings = {
        notifications_enabled: settingsData.notifications_enabled,
        sound_enabled: settingsData.sound_enabled,
        vibration_enabled: settingsData.vibration_enabled,
        marketing_enabled: settingsData.marketing_enabled,
        location_enabled: settingsData.location_enabled
      };
    }

    return NextResponse.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Customer settings get error:', error);
    return NextResponse.json(
      { error: 'Ayarlar alınırken bir hata oluştu' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    // Get user ID from authenticated user
    const userId = authResult.user.id;

    // Parse request body
    const body = await request.json();
    
    // Validate request body
    const { error, value } = settingsUpdateSchema.validate(body);
    if (error) {
      return NextResponse.json(
        { error: 'Geçersiz veri formatı', details: error.details },
        { status: 400 }
      );
    }

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    // Check if settings exist
    const existingSettings = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT id FROM customer_settings WHERE user_id = @userId
      `);

    if (existingSettings.recordset.length === 0) {
      // Create new settings record
      await pool.request()
        .input('userId', sql.Int, userId)
        .input('notificationsEnabled', sql.Bit, value.notifications_enabled ?? true)
        .input('soundEnabled', sql.Bit, value.sound_enabled ?? true)
        .input('vibrationEnabled', sql.Bit, value.vibration_enabled ?? true)
        .input('marketingEnabled', sql.Bit, value.marketing_enabled ?? true)
        .input('locationEnabled', sql.Bit, value.location_enabled ?? true)
        .query(`
          INSERT INTO customer_settings (user_id, notifications_enabled, sound_enabled, vibration_enabled, marketing_enabled, location_enabled)
          VALUES (@userId, @notificationsEnabled, @soundEnabled, @vibrationEnabled, @marketingEnabled, @locationEnabled)
        `);
    } else {
      // Build dynamic update query
      const updateFields = [];
      const request = pool.request().input('userId', sql.Int, userId);
      
      if (value.notifications_enabled !== undefined) {
        updateFields.push('notifications_enabled = @notificationsEnabled');
        request.input('notificationsEnabled', sql.Bit, value.notifications_enabled);
      }
      
      if (value.sound_enabled !== undefined) {
        updateFields.push('sound_enabled = @soundEnabled');
        request.input('soundEnabled', sql.Bit, value.sound_enabled);
      }
      
      if (value.vibration_enabled !== undefined) {
        updateFields.push('vibration_enabled = @vibrationEnabled');
        request.input('vibrationEnabled', sql.Bit, value.vibration_enabled);
      }
      
      if (value.marketing_enabled !== undefined) {
        updateFields.push('marketing_enabled = @marketingEnabled');
        request.input('marketingEnabled', sql.Bit, value.marketing_enabled);
      }
      
      if (value.location_enabled !== undefined) {
        updateFields.push('location_enabled = @locationEnabled');
        request.input('locationEnabled', sql.Bit, value.location_enabled);
      }
      
      if (updateFields.length > 0) {
        updateFields.push('updated_at = GETDATE()');
        
        await request.query(`
          UPDATE customer_settings 
          SET ${updateFields.join(', ')}
          WHERE user_id = @userId
        `);
      }
    }

    // Get updated settings
    const updatedSettingsResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT 
          notifications_enabled,
          sound_enabled,
          vibration_enabled,
          marketing_enabled,
          location_enabled
        FROM customer_settings 
        WHERE user_id = @userId
      `);

    const updatedSettings = updatedSettingsResult.recordset[0];

    return NextResponse.json({
      success: true,
      message: 'Ayarlar başarıyla güncellendi',
      data: {
        notifications_enabled: updatedSettings.notifications_enabled,
        sound_enabled: updatedSettings.sound_enabled,
        vibration_enabled: updatedSettings.vibration_enabled,
        marketing_enabled: updatedSettings.marketing_enabled,
        location_enabled: updatedSettings.location_enabled
      }
    });

  } catch (error) {
    console.error('Customer settings update error:', error);
    return NextResponse.json(
      { error: 'Ayarlar güncellenirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}