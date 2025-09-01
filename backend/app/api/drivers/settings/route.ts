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
  location_sharing_enabled: Joi.boolean().optional()
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
    
    // Get driver ID from user ID
    const driverResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT id FROM drivers WHERE user_id = @userId
      `);

    if (driverResult.recordset.length === 0) {
      return NextResponse.json(
        { error: 'Sürücü bulunamadı' },
        { status: 404 }
      );
    }

    const driverId = driverResult.recordset[0].id;
    
    // Get driver settings
    const settingsResult = await pool.request()
      .input('driverId', sql.Int, driverId)
      .query(`
        SELECT 
          notifications_enabled,
          sound_enabled,
          vibration_enabled,
          location_sharing_enabled,
          created_at,
          updated_at
        FROM driver_settings 
        WHERE driver_id = @driverId
      `);

    let settings;
    if (settingsResult.recordset.length === 0) {
      // Create default settings if not exists
      await pool.request()
        .input('driverId', sql.Int, driverId)
        .query(`
          INSERT INTO driver_settings (driver_id, notifications_enabled, sound_enabled, vibration_enabled, location_sharing_enabled)
          VALUES (@driverId, 1, 1, 1, 1)
        `);
      
      settings = {
        notifications_enabled: true,
        sound_enabled: true,
        vibration_enabled: true,
        location_sharing_enabled: true
      };
    } else {
      const settingsData = settingsResult.recordset[0];
      settings = {
        notifications_enabled: settingsData.notifications_enabled,
        sound_enabled: settingsData.sound_enabled,
        vibration_enabled: settingsData.vibration_enabled,
        location_sharing_enabled: settingsData.location_sharing_enabled
      };
    }

    return NextResponse.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Driver settings get error:', error);
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
    
    // Get driver ID from user ID
    const driverResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT id FROM drivers WHERE user_id = @userId
      `);

    if (driverResult.recordset.length === 0) {
      return NextResponse.json(
        { error: 'Sürücü bulunamadı' },
        { status: 404 }
      );
    }

    const driverId = driverResult.recordset[0].id;
    
    // Check if settings exist
    const existingSettings = await pool.request()
      .input('driverId', sql.Int, driverId)
      .query(`
        SELECT id FROM driver_settings WHERE driver_id = @driverId
      `);

    if (existingSettings.recordset.length === 0) {
      // Create new settings record
      await pool.request()
        .input('driverId', sql.Int, driverId)
        .input('notificationsEnabled', sql.Bit, value.notifications_enabled ?? true)
        .input('soundEnabled', sql.Bit, value.sound_enabled ?? true)
        .input('vibrationEnabled', sql.Bit, value.vibration_enabled ?? true)
        .input('locationSharingEnabled', sql.Bit, value.location_sharing_enabled ?? true)
        .query(`
          INSERT INTO driver_settings (driver_id, notifications_enabled, sound_enabled, vibration_enabled, location_sharing_enabled)
          VALUES (@driverId, @notificationsEnabled, @soundEnabled, @vibrationEnabled, @locationSharingEnabled)
        `);
    } else {
      // Build dynamic update query
      const updateFields = [];
      const request = pool.request().input('driverId', sql.Int, driverId);
      
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
      
      if (value.location_sharing_enabled !== undefined) {
        updateFields.push('location_sharing_enabled = @locationSharingEnabled');
        request.input('locationSharingEnabled', sql.Bit, value.location_sharing_enabled);
      }
      
      if (updateFields.length > 0) {
        updateFields.push('updated_at = GETDATE()');
        
        await request.query(`
          UPDATE driver_settings 
          SET ${updateFields.join(', ')}
          WHERE driver_id = @driverId
        `);
      }
    }

    // Get updated settings
    const updatedSettingsResult = await pool.request()
      .input('driverId', sql.Int, driverId)
      .query(`
        SELECT 
          notifications_enabled,
          sound_enabled,
          vibration_enabled,
          location_sharing_enabled
        FROM driver_settings 
        WHERE driver_id = @driverId
      `);

    const updatedSettings = updatedSettingsResult.recordset[0];

    return NextResponse.json({
      success: true,
      message: 'Ayarlar başarıyla güncellendi',
      data: {
        notifications_enabled: updatedSettings.notifications_enabled,
        sound_enabled: updatedSettings.sound_enabled,
        vibration_enabled: updatedSettings.vibration_enabled,
        location_sharing_enabled: updatedSettings.location_sharing_enabled
      }
    });

  } catch (error) {
    console.error('Driver settings update error:', error);
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