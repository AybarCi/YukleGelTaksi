import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '../../../../middleware/auth';
import DatabaseConnection from '../../../../config/database';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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
  vehicle_color?: string;
  vehicle_year: number;
  driver_photo?: string;
  license_photo?: string;
  eligibility_certificate?: string;
  // File upload support
  uploaded_files?: {
    driver_photo?: string;
    license_photo?: string;
    eligibility_certificate?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    // Get phone number from authenticated user
    const userPhoneNumber = authResult.user.phone_number;

    // Parse FormData
    const formData = await request.formData();
    
    // Extract form fields
    const tc_number = formData.get('tc_number') as string;
    const first_name = formData.get('first_name') as string;
    const last_name = formData.get('last_name') as string;
    const email = formData.get('email') as string;
    const tax_number = formData.get('tax_number') as string;
    const tax_office = formData.get('tax_office') as string;
    const license_number = formData.get('license_number') as string;
    const license_expiry_date = formData.get('license_expiry_date') as string;
    const vehicle_type = formData.get('vehicle_type') as string;
    const vehicle_plate = formData.get('vehicle_plate') as string;
    const vehicle_model = formData.get('vehicle_model') as string;
    const vehicle_color = formData.get('vehicle_color') as string;
    const vehicle_year = parseInt(formData.get('vehicle_year') as string);
    
    // Extract files
    const driverPhotoFile = formData.get('driver_photo') as File;
    const licensePhotoFile = formData.get('license_photo') as File;
    const eligibilityCertificateFile = formData.get('eligibility_certificate') as File;
    
    // Handle file uploads
    let finalDriverPhoto = '';
    let finalLicensePhoto = '';
    let finalEligibilityCertificate = '';
    
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
    
    if (driverPhotoFile && driverPhotoFile.size > 0) {
      const fileName = `${uuidv4()}.${driverPhotoFile.name.split('.').pop()}`;
      const filePath = path.join(uploadsDir, fileName);
      const buffer = Buffer.from(await driverPhotoFile.arrayBuffer());
      await writeFile(filePath, buffer);
      finalDriverPhoto = fileName;
    }
    
    if (licensePhotoFile && licensePhotoFile.size > 0) {
      const fileName = `${uuidv4()}.${licensePhotoFile.name.split('.').pop()}`;
      const filePath = path.join(uploadsDir, fileName);
      const buffer = Buffer.from(await licensePhotoFile.arrayBuffer());
      await writeFile(filePath, buffer);
      finalLicensePhoto = fileName;
    }
    
    if (eligibilityCertificateFile && eligibilityCertificateFile.size > 0) {
      const fileName = `${uuidv4()}.${eligibilityCertificateFile.name.split('.').pop()}`;
      const filePath = path.join(uploadsDir, fileName);
      const buffer = Buffer.from(await eligibilityCertificateFile.arrayBuffer());
      await writeFile(filePath, buffer);
      finalEligibilityCertificate = fileName;
    }
    // Validation
    if (!tc_number || !first_name || !last_name || !license_number || !vehicle_plate || !vehicle_model) {
      return NextResponse.json(
        { error: 'Zorunlu alanlar eksik' },
        { status: 400 }
      );
    }

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();

    // Check if phone number already exists in users table
    const existingUserResult = await pool.request()
      .input('phone_number', userPhoneNumber)
      .query('SELECT id FROM users WHERE phone_number = @phone_number');

    // Check if phone number already exists in drivers table
    const existingDriverResult = await pool.request()
      .input('phone_number', userPhoneNumber)
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
        // Generate a unique email if not provided to avoid UNIQUE constraint violation
        const userEmail = email || `driver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@yuklegeltaksi.com`;
        
        const userInsertResult = await transaction.request()
          .input('phone_number', userPhoneNumber)
          .input('first_name', first_name)
          .input('last_name', last_name)
          .input('email', userEmail)
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
        .input('user_id', userId)
        .input('tc_number', tc_number)
        .input('first_name', first_name)
        .input('last_name', last_name)
        .input('email', email || null)
        .input('tax_number', tax_number || null)
        .input('tax_office', tax_office || null)
        .input('license_number', license_number)
        .input('license_expiry_date', license_expiry_date || null)
        .input('vehicle_type', vehicle_type)
        .input('vehicle_plate', vehicle_plate)
        .input('vehicle_model', vehicle_model)
        .input('vehicle_color', vehicle_color || null)
        .input('vehicle_year', vehicle_year)
        .input('driver_photo', finalDriverPhoto || null)
        .input('license_photo', finalLicensePhoto || null)
        .input('eligibility_certificate', finalEligibilityCertificate || null)
        .query(`
          INSERT INTO drivers (
            user_id, tc_number, first_name, last_name, email,
            tax_number, tax_office, license_number, license_expiry_date,
            vehicle_type, vehicle_plate, vehicle_model, vehicle_color, vehicle_year,
            driver_photo, license_photo, eligibility_certificate,
            is_approved, is_active, created_at, updated_at
          )
          OUTPUT INSERTED.id
          VALUES (
            @user_id, @tc_number, @first_name, @last_name, @email,
            @tax_number, @tax_office, @license_number, @license_expiry_date,
            @vehicle_type, @vehicle_plate, @vehicle_model, @vehicle_color, @vehicle_year,
            @driver_photo, @license_photo, @eligibility_certificate,
            0, 1, GETDATE(), GETDATE()
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
          phone_number: userPhoneNumber,
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