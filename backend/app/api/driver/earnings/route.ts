import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '../../../../middleware/auth';
import DatabaseConnection from '../../../../config/database';
import sql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    // Token doğrulama
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    // Sürücü ID'sini al
    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    const driverResult = await pool.request()
      .input('userId', sql.Int, authResult.user.id)
      .query('SELECT id FROM drivers WHERE user_id = @userId AND is_active = 1');
    
    if (driverResult.recordset.length === 0) {
      return NextResponse.json(
        { error: 'Sürücü bulunamadı' },
        { status: 404 }
      );
    }
    
    const driverId = driverResult.recordset[0].id;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // today, week, month, all
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Pool zaten yukarıda tanımlandı

    // Tarih filtresi oluştur
    let dateFilter = '';
    switch (period) {
      case 'today':
        dateFilter = 'AND earning_date = CAST(GETDATE() AS DATE)';
        break;
      case 'week':
        dateFilter = 'AND earning_date >= DATEADD(DAY, -7, CAST(GETDATE() AS DATE))';
        break;
      case 'month':
        dateFilter = 'AND earning_date >= DATEADD(DAY, -30, CAST(GETDATE() AS DATE))';
        break;
      default:
        dateFilter = '';
    }

    // Toplam kazanç istatistikleri
    const statsQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN earning_date = CAST(GETDATE() AS DATE) THEN net_amount END), 0) as today_earnings,
        COALESCE(SUM(CASE WHEN earning_date >= DATEADD(DAY, -7, CAST(GETDATE() AS DATE)) THEN net_amount END), 0) as week_earnings,
        COALESCE(SUM(CASE WHEN earning_date >= DATEADD(DAY, -30, CAST(GETDATE() AS DATE)) THEN net_amount END), 0) as month_earnings,
        COALESCE(SUM(net_amount), 0) as total_earnings,
        COUNT(CASE WHEN earning_date = CAST(GETDATE() AS DATE) THEN 1 END) as today_trips,
        COUNT(CASE WHEN earning_date >= DATEADD(DAY, -7, CAST(GETDATE() AS DATE)) THEN 1 END) as week_trips,
        COUNT(CASE WHEN earning_date >= DATEADD(DAY, -30, CAST(GETDATE() AS DATE)) THEN 1 END) as month_trips,
        COUNT(*) as total_trips,
        COALESCE(AVG(amount), 0) as average_fare,
        COALESCE(AVG(commission_amount), 0) as average_commission
      FROM driver_earnings 
      WHERE driver_id = @driverId
    `;

    const statsResult = await pool.request()
      .input('driverId', sql.Int, driverId)
      .query(statsQuery);

    const stats = statsResult.recordset[0];
    const commissionRate = stats.average_fare > 0 ? (stats.average_commission / stats.average_fare * 100) : 15;

    // Detaylı kazanç listesi
    const earningsQuery = `
      SELECT 
        id,
        trip_id,
        amount,
        commission_amount,
        net_amount,
        earning_type,
        description,
        earning_date,
        created_at
      FROM driver_earnings 
      WHERE driver_id = @driverId ${dateFilter}
      ORDER BY earning_date DESC, created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const earningsResult = await pool.request()
      .input('driverId', sql.Int, driverId)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit)
      .query(earningsQuery);

    // Toplam kayıt sayısı
    const countQuery = `
      SELECT COUNT(*) as total
      FROM driver_earnings 
      WHERE driver_id = @driverId ${dateFilter}
    `;

    const countResult = await pool.request()
      .input('driverId', sql.Int, driverId)
      .query(countQuery);

    const totalRecords = countResult.recordset[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // Günlük kazanç özeti (son 30 gün)
    const dailyQuery = `
      SELECT 
        earning_date as date,
        SUM(net_amount) as earnings,
        COUNT(*) as trips,
        0 as hours_worked
      FROM driver_earnings 
      WHERE driver_id = @driverId 
        AND earning_date >= DATEADD(DAY, -30, CAST(GETDATE() AS DATE))
      GROUP BY earning_date
      ORDER BY earning_date DESC
    `;

    const dailyResult = await pool.request()
      .input('driverId', sql.Int, driverId)
      .query(dailyQuery);

    const response = {
      // Ana istatistikler
      total_earnings: parseFloat(stats.total_earnings) || 0,
      today_earnings: parseFloat(stats.today_earnings) || 0,
      week_earnings: parseFloat(stats.week_earnings) || 0,
      month_earnings: parseFloat(stats.month_earnings) || 0,
      total_trips: stats.total_trips || 0,
      today_trips: stats.today_trips || 0,
      week_trips: stats.week_trips || 0,
      month_trips: stats.month_trips || 0,
      average_fare: parseFloat(stats.average_fare) || 0,
      commission_rate: parseFloat(commissionRate.toFixed(2)) || 15,
      net_earnings: parseFloat(stats.total_earnings) || 0,
      
      // Sayfalama bilgileri
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: totalRecords,
        per_page: limit
      },
      
      // Kazanç listesi
      earnings: earningsResult.recordset.map((earning: any) => ({
        id: earning.id,
        trip_id: earning.trip_id,
        amount: parseFloat(earning.amount),
        commission_amount: parseFloat(earning.commission_amount),
        net_amount: parseFloat(earning.net_amount),
        earning_type: earning.earning_type,
        description: earning.description,
        earning_date: earning.earning_date,
        created_at: earning.created_at
      })),
      
      // Günlük özet (mobil app için)
      daily_earnings: dailyResult.recordset.map((daily: any) => ({
        date: daily.date,
        earnings: parseFloat(daily.earnings),
        trips: daily.trips,
        hours_worked: daily.hours_worked
      }))
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Driver earnings fetch error:', error);
    return NextResponse.json(
      { error: 'Kazanç bilgileri alınamadı' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Token doğrulama
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    // Sürücü ID'sini al
    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    const driverResult = await pool.request()
      .input('userId', sql.Int, authResult.user.id)
      .query('SELECT id FROM drivers WHERE user_id = @userId AND is_active = 1');
    
    if (driverResult.recordset.length === 0) {
      return NextResponse.json(
        { error: 'Sürücü bulunamadı' },
        { status: 404 }
      );
    }
    
    const driverId = driverResult.recordset[0].id;
    
    // Request body'yi al
    const body = await request.json();
    const { 
      amount, 
      commission_amount = 0, 
      earning_type = 'manual', 
      description = '', 
      earning_date,
      trip_id = null 
    } = body;

    // Validasyon
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Geçerli bir kazanç miktarı giriniz' },
        { status: 400 }
      );
    }

    if (commission_amount < 0) {
      return NextResponse.json(
        { error: 'Komisyon miktarı negatif olamaz' },
        { status: 400 }
      );
    }

    if (!earning_date) {
      return NextResponse.json(
        { error: 'Kazanç tarihi gerekli' },
        { status: 400 }
      );
    }

    // Net kazancı hesapla
    const net_amount = parseFloat(amount) - parseFloat(commission_amount);

    // Kazancı veritabanına ekle
    const insertResult = await pool.request()
      .input('driverId', sql.Int, driverId)
      .input('tripId', sql.Int, trip_id)
      .input('amount', sql.Decimal(10, 2), amount)
      .input('commissionAmount', sql.Decimal(10, 2), commission_amount)
      .input('netAmount', sql.Decimal(10, 2), net_amount)
      .input('earningType', sql.NVarChar(50), earning_type)
      .input('description', sql.NVarChar(500), description)
      .input('earningDate', sql.Date, earning_date)
      .query(`
        INSERT INTO driver_earnings (
          driver_id, trip_id, amount, commission_amount, net_amount, 
          earning_type, description, earning_date
        ) 
        OUTPUT INSERTED.id, INSERTED.created_at
        VALUES (
          @driverId, @tripId, @amount, @commissionAmount, @netAmount,
          @earningType, @description, @earningDate
        )
      `);

    const newEarning = insertResult.recordset[0];

    return NextResponse.json({
      success: true,
      message: 'Kazanç başarıyla eklendi',
      earning: {
        id: newEarning.id,
        driver_id: driverId,
        trip_id: trip_id,
        amount: parseFloat(amount),
        commission_amount: parseFloat(commission_amount),
        net_amount: net_amount,
        earning_type: earning_type,
        description: description,
        earning_date: earning_date,
        created_at: newEarning.created_at
      }
    });

  } catch (error) {
    console.error('Driver earnings insert error:', error);
    return NextResponse.json(
      { error: 'Kazanç eklenirken hata oluştu' },
      { status: 500 }
    );
  }
}