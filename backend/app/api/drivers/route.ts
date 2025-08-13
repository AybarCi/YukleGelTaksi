import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../config/database';
import sql from 'mssql';

interface Driver {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  tc_number?: string;
  license_number: string;
  license_expiry_date?: string;
  vehicle_type: string;
  vehicle_plate: string;
  vehicle_model: string;
  vehicle_color?: string;
  vehicle_year: number;
  driver_photo?: string;
  license_photo?: string;
  eligibility_certificate?: string;
  is_verified: boolean;
  is_available: boolean;
  rating: number;
  total_trips: number;
  current_latitude?: number;
  current_longitude?: number;
  last_location_update?: string;
  created_at: string;
  updated_at: string;
}

interface ApiResponse {
  message: string;
  data?: Driver[];
  error?: string;
}

// GET - Tüm sürücüleri listele
export async function GET(request: NextRequest) {
  try {
    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    const result = await pool.request().query(`
      SELECT TOP 10 * FROM drivers
    `);

    const drivers: Driver[] = result.recordset;

    const response: ApiResponse = {
      message: 'Sürücüler başarıyla listelendi',
      data: drivers
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Drivers list error:', error);
    
    const response: ApiResponse = {
      message: 'Sürücüler listelenirken bir hata oluştu',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// PUT - Sürücü bilgilerini güncelle
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      first_name,
      last_name,
      phone_number,
      tc_number,
      license_number,
      license_expiry_date,
      vehicle_type,
      vehicle_plate,
      vehicle_model,
      vehicle_color,
      vehicle_year,
      is_verified,
      is_available
    } = body;

    if (!id) {
      return NextResponse.json(
        { message: 'Sürücü ID gerekli', error: 'ID eksik' },
        { status: 400 }
      );
    }

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('first_name', sql.NVarChar(100), first_name)
      .input('last_name', sql.NVarChar(100), last_name)
      .input('phone_number', sql.NVarChar(20), phone_number)
      .input('tc_number', sql.NVarChar(11), tc_number || null)
      .input('license_number', sql.NVarChar(50), license_number)
      .input('license_expiry_date', sql.Date, license_expiry_date || null)
      .input('vehicle_type', sql.NVarChar(50), vehicle_type)
      .input('vehicle_plate', sql.NVarChar(20), vehicle_plate)
      .input('vehicle_model', sql.NVarChar(100), vehicle_model)
      .input('vehicle_color', sql.NVarChar(50), vehicle_color || null)
      .input('vehicle_year', sql.Int, vehicle_year)
      .input('is_verified', sql.Bit, is_verified)
      .input('is_available', sql.Bit, is_available)
      .query(`
        UPDATE drivers 
        SET 
          first_name = @first_name,
          last_name = @last_name,
          phone_number = @phone_number,
          tc_number = @tc_number,
          license_number = @license_number,
          license_expiry_date = @license_expiry_date,
          vehicle_type = @vehicle_type,
          vehicle_plate = @vehicle_plate,
          vehicle_model = @vehicle_model,
          vehicle_color = @vehicle_color,
          vehicle_year = @vehicle_year,
          is_verified = @is_verified,
          is_available = @is_available,
          updated_at = GETDATE()
        WHERE id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      return NextResponse.json(
        { message: 'Sürücü bulunamadı', error: 'Geçersiz ID' },
        { status: 404 }
      );
    }

    const response: ApiResponse = {
      message: 'Sürücü bilgileri başarıyla güncellendi'
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Driver update error:', error);
    
    const response: ApiResponse = {
      message: 'Sürücü güncellenirken bir hata oluştu',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// DELETE - Sürücü sil
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'Sürücü ID gerekli', error: 'ID eksik' },
        { status: 400 }
      );
    }

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    const result = await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query('DELETE FROM drivers WHERE id = @id');

    if (result.rowsAffected[0] === 0) {
      return NextResponse.json(
        { message: 'Sürücü bulunamadı', error: 'Geçersiz ID' },
        { status: 404 }
      );
    }

    const response: ApiResponse = {
      message: 'Sürücü başarıyla silindi'
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Driver delete error:', error);
    
    const response: ApiResponse = {
      message: 'Sürücü silinirken bir hata oluştu',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    };

    return NextResponse.json(response, { status: 500 });
  }
}