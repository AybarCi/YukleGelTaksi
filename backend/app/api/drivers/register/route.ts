import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupervisorToken } from '../../../../middleware/supervisorAuth';
import DatabaseConnection from '../../../../config/database';

interface RegisterDriverRequest {
  tc_number: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email?: string;
  tax_number?: string;
  tax_office?: string;
  license_number: string;
  license_expiry_date: string;
  vehicle_type: string;
  vehicle_plate: string;
  vehicle_model: string;
  vehicle_year: number;
  driver_photo?: string;
  license_photo?: string;
  eligibility_certificate?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate supervisor
    const authResult = await authenticateSupervisorToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    const body: RegisterDriverRequest = await request.json();
    const {
      tc_number,
      first_name,
      last_name,
      phone_number,
      email,
      tax_number,
      tax_office,
      license_number,
      license_expiry_date,
      vehicle_type,
      vehicle_plate,
      vehicle_model,
      vehicle_year,
      driver_photo,
      license_photo,
      eligibility_certificate
    } = body;

    // Validation
    if (!tc_number || !first_name || !last_name || !phone_number || !license_number || !vehicle_plate || !vehicle_model) {
      return NextResponse.json(
        { error: 'Zorunlu alanlar eksik' },
        { status: 400 }
      );
    }

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();

    // Check if phone number already exists in users table
    const existingUserResult = await pool.request()
      .input('phone_number', phone_number)
      .query('SELECT id FROM users WHERE phone_number = @phone_number');

    // Check if phone number already exists in drivers table
    const existingDriverResult = await pool.request()
      .input('phone_number', phone_number)
      .query('SELECT id FROM drivers WHERE phone_number = @phone_number');

    if (existingDriverResult.recordset.length > 0) {
      return NextResponse.json(
        { error: 'Bu telefon numarası ile kayıtlı sürücü zaten mevcut' },
        { status: 400 }
      );
    }

    // Check if license number already exists
    const existingLicenseResult = await pool.request()
      .input('license_number', license_number)
      .query('SELECT id FROM drivers WHERE license_number = @license_number');

    if (existingLicenseResult.recordset.length > 0) {
      return NextResponse.json(
        { error: 'Bu ehliyet numarası ile kayıtlı sürücü zaten mevcut' },
        { status: 400 }
      );
    }

    // Start transaction
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      let userId;

      // If user doesn't exist, create user record
      if (existingUserResult.recordset.length === 0) {
        const userInsertResult = await transaction.request()
          .input('phone_number', phone_number)
          .input('first_name', first_name)
          .input('last_name', last_name)
          .input('email', email || null)
          .input('user_type', 'driver')
          .query(`
            INSERT INTO users (phone_number, first_name, last_name, email, user_type, is_active, created_at, updated_at)
            OUTPUT INSERTED.id
            VALUES (@phone_number, @first_name, @last_name, @email, @user_type, 1, GETDATE(), GETDATE())
          `);
        
        userId = userInsertResult.recordset[0].id;
      } else {
        // Update existing user to driver type
        userId = existingUserResult.recordset[0].id;
        await transaction.request()
          .input('user_id', userId)
          .input('user_type', 'driver')
          .query('UPDATE users SET user_type = @user_type, updated_at = GETDATE() WHERE id = @user_id');
      }

      // Insert driver record
      const driverInsertResult = await transaction.request()
        .input('tc_number', tc_number)
        .input('first_name', first_name)
        .input('last_name', last_name)
        .input('phone_number', phone_number)
        .input('email', email || null)
        .input('tax_number', tax_number || null)
        .input('tax_office', tax_office || null)
        .input('license_number', license_number)
        .input('license_expiry_date', license_expiry_date)
        .input('vehicle_type', vehicle_type)
        .input('vehicle_plate', vehicle_plate)
        .input('vehicle_model', vehicle_model)
        .input('vehicle_year', vehicle_year)
        .input('driver_photo', driver_photo || null)
        .input('license_photo', license_photo || null)
        .input('eligibility_certificate', eligibility_certificate || null)
        .query(`
          INSERT INTO drivers (
            tc_number, first_name, last_name, phone_number, email, tax_number, tax_office,
            license_number, license_expiry_date, vehicle_type, vehicle_plate, vehicle_model, 
            vehicle_year, driver_photo, license_photo, eligibility_certificate,
            is_available, is_active, rating, created_at, updated_at
          )
          OUTPUT INSERTED.id
          VALUES (
            @tc_number, @first_name, @last_name, @phone_number, @email, @tax_number, @tax_office,
            @license_number, @license_expiry_date, @vehicle_type, @vehicle_plate, @vehicle_model,
            @vehicle_year, @driver_photo, @license_photo, @eligibility_certificate,
            0, 1, 5.0, GETDATE(), GETDATE()
          )
        `);

      const driverId = driverInsertResult.recordset[0].id;

      // Commit transaction
      await transaction.commit();

      return NextResponse.json({
        success: true,
        message: 'Sürücü başarıyla kaydedildi',
        data: {
          driverId,
          userId,
          phone_number,
          first_name,
          last_name
        }
      }, { status: 201 });

    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Driver registration error:', error);
    return NextResponse.json(
      { error: 'Sürücü kaydı sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}