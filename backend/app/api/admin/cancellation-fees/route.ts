import { NextRequest, NextResponse } from 'next/server';
import sql, { Transaction } from 'mssql';
import DatabaseConnection from '../../../../config/database';
import { authenticateSupervisorToken } from '../../../../middleware/supervisorAuth';

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

interface CancellationFee {
  id: number;
  order_status: string;
  fee_percentage: number;
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

// GET - Cezai şart ayarlarını getir
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

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();
    
    // Tablo varlığını kontrol et ve gerekirse oluştur
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='cancellation_fees' AND xtype='U')
        BEGIN
          CREATE TABLE cancellation_fees (
            id INT IDENTITY(1,1) PRIMARY KEY,
            order_status NVARCHAR(50) NOT NULL,
            fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
            is_active BIT NOT NULL DEFAULT 1,
            description NVARCHAR(255),
            created_at DATETIME2 DEFAULT GETDATE(),
            updated_at DATETIME2 DEFAULT GETDATE()
          );
          
          CREATE INDEX IX_cancellation_fees_order_status ON cancellation_fees(order_status);
          CREATE INDEX IX_cancellation_fees_is_active ON cancellation_fees(is_active);
        END
      `);
    } catch (tableError) {
      console.log('Tablo oluşturma/kontrol hatası:', tableError);
    }
    
    // Mevcut cezai şart ayarlarını getir
    const result = await pool.request().query(`
      SELECT id, order_status, fee_percentage, is_active, description, created_at, updated_at
      FROM cancellation_fees
      ORDER BY 
        CASE order_status
          WHEN 'pending' THEN 1
          WHEN 'inspecting' THEN 2
          WHEN 'driver_accepted_awaiting_customer' THEN 3
          WHEN 'confirmed' THEN 4
          WHEN 'driver_going_to_pickup' THEN 5
          WHEN 'pickup_completed' THEN 6
          WHEN 'in_transit' THEN 7
          WHEN 'delivered' THEN 8
          WHEN 'payment_completed' THEN 9
          ELSE 10
        END
    `);

    const cancellationFees: CancellationFee[] = result.recordset;

    // Eğer hiç kayıt yoksa, varsayılan kayıtları oluştur
    if (cancellationFees.length === 0) {
      const defaultStatuses = [
        { status: 'pending', percentage: 0, description: 'Beklemede olan siparişler için cezai şart yok' },
        { status: 'inspecting', percentage: 0, description: 'İnceleme aşamasındaki siparişler için cezai şart yok' },
        { status: 'driver_accepted_awaiting_customer', percentage: 0, description: 'Sürücü kabul etti, müşteri onayı bekleniyor - cezai şart yok' },
        { status: 'confirmed', percentage: 10, description: 'Onaylanmış siparişler için %10 cezai şart' },
        { status: 'driver_going_to_pickup', percentage: 15, description: 'Sürücü yola çıktı - %15 cezai şart' },
        { status: 'pickup_completed', percentage: 25, description: 'Yük alındı - %25 cezai şart' },
        { status: 'in_transit', percentage: 50, description: 'Yolda olan siparişler - %50 cezai şart' },
        { status: 'delivered', percentage: 100, description: 'Teslim edilmiş siparişler - iptal edilemez, %100 cezai şart' },
        { status: 'payment_completed', percentage: 100, description: 'Ödemesi tamamlanmış siparişler - iptal edilemez, %100 cezai şart' }
      ];

      for (const defaultStatus of defaultStatuses) {
        await pool.request()
          .input('order_status', sql.VarChar, defaultStatus.status)
          .input('fee_percentage', sql.Decimal(5,2), defaultStatus.percentage)
          .input('is_active', sql.Bit, true)
          .input('description', sql.NVarChar, defaultStatus.description)
          .query(`
            INSERT INTO cancellation_fees (order_status, fee_percentage, is_active, description)
            VALUES (@order_status, @fee_percentage, @is_active, @description)
          `);
      }

      // Yeni oluşturulan kayıtları getir
      const newResult = await pool.request().query(`
        SELECT id, order_status, fee_percentage, is_active, description, created_at, updated_at
        FROM cancellation_fees
        ORDER BY 
          CASE order_status
            WHEN 'pending' THEN 1
            WHEN 'inspecting' THEN 2
            WHEN 'driver_accepted_awaiting_customer' THEN 3
            WHEN 'confirmed' THEN 4
            WHEN 'driver_going_to_pickup' THEN 5
            WHEN 'pickup_completed' THEN 6
            WHEN 'in_transit' THEN 7
            WHEN 'delivered' THEN 8
            WHEN 'payment_completed' THEN 9
            ELSE 10
          END
      `);

      return NextResponse.json({
        success: true,
        data: newResult.recordset
      });
    }

    return NextResponse.json({
      success: true,
      data: cancellationFees
    });

  } catch (error) {
    console.error('Cezai şart ayarları getirme hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

// PUT - Cezai şart ayarlarını güncelle
export async function PUT(request: NextRequest) {
  try {
    // Supervisor token doğrulama
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { cancellationFees } = body;

    if (!cancellationFees || !Array.isArray(cancellationFees)) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz veri formatı' },
        { status: 400 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();
    
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();

      // Her bir cezai şart ayarını güncelle
      for (const fee of cancellationFees) {
        if (!fee.id || typeof fee.fee_percentage !== 'number' || typeof fee.is_active !== 'boolean') {
          await transaction.rollback();
          return NextResponse.json(
            { success: false, error: 'Geçersiz cezai şart verisi' },
            { status: 400 }
          );
        }

        // Yüzde değeri 0-100 arasında olmalı
        if (fee.fee_percentage < 0 || fee.fee_percentage > 100) {
          await transaction.rollback();
          return NextResponse.json(
            { success: false, error: 'Cezai şart yüzdesi 0-100 arasında olmalıdır' },
            { status: 400 }
          );
        }

        await transaction.request()
          .input('fee_percentage', sql.Decimal(5,2), fee.fee_percentage)
          .input('is_active', sql.Bit, fee.is_active)
          .input('id', sql.Int, fee.id)
          .query(`
            UPDATE cancellation_fees 
            SET fee_percentage = @fee_percentage, is_active = @is_active, updated_at = GETDATE()
            WHERE id = @id
          `);
      }

      await transaction.commit();

      return NextResponse.json({
        success: true,
        message: 'Cezai şart ayarları başarıyla güncellendi'
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Cezai şart ayarları güncelleme hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}