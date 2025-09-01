import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import { authenticateSupervisorToken } from '../../../../middleware/supervisorAuth';

interface CustomerSupportTicket {
  id: number;
  user_id: number;
  issue_type: string;
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  admin_response?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
}

// GET - Tüm müşteri destek taleplerini listele
export async function GET(request: NextRequest) {
  try {
    // Token doğrulama
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.message },
        { status: 401 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Müşteri destek taleplerini kullanıcı bilgileri ile birlikte getir
    const query = `
      SELECT 
        cst.*,
        u.first_name + ' ' + u.last_name as customer_name,
        u.phone_number as customer_phone,
        u.email as customer_email
      FROM customer_support_tickets cst
      LEFT JOIN users u ON cst.user_id = u.id
      WHERE u.user_type = 'customer'
      ORDER BY cst.created_at DESC
    `;

    const result = await pool.request().query(query);
    const tickets = result.recordset;

    return NextResponse.json({
      success: true,
      tickets: tickets,
      total: tickets.length
    });

  } catch (error: any) {
    console.error('Müşteri destek talepleri getirme hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Müşteri destek talepleri alınamadı' },
      { status: 500 }
    );
  }
}

// PUT - Toplu güncelleme
export async function PUT(request: NextRequest) {
  try {
    // Token doğrulama
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.message },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { ticket_ids, action, data } = body;

    if (!ticket_ids || !Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Geçerli ticket ID\'leri gerekli' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'İşlem türü gerekli' },
        { status: 400 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    let updateQuery = '';
    let updateParams: any = {};

    switch (action) {
      case 'take':
        updateQuery = `
          UPDATE customer_support_tickets 
          SET status = 'in_progress', updated_at = GETDATE()
          WHERE id IN (${ticket_ids.map((_, index) => `@id${index}`).join(', ')})
        `;
        break;

      case 'resolve':
        updateQuery = `
          UPDATE customer_support_tickets 
          SET status = 'resolved', resolved_at = GETDATE(), updated_at = GETDATE()
          WHERE id IN (${ticket_ids.map((_, index) => `@id${index}`).join(', ')})
        `;
        break;

      case 'update_priority':
        if (!data?.priority) {
          return NextResponse.json(
            { success: false, error: 'Öncelik değeri gerekli' },
            { status: 400 }
          );
        }
        updateQuery = `
          UPDATE customer_support_tickets 
          SET priority = @priority, updated_at = GETDATE()
          WHERE id IN (${ticket_ids.map((_, index) => `@id${index}`).join(', ')})
        `;
        updateParams.priority = data.priority;
        break;

      case 'update_status':
        if (!data?.status) {
          return NextResponse.json(
            { success: false, error: 'Durum değeri gerekli' },
            { status: 400 }
          );
        }
        updateQuery = `
          UPDATE customer_support_tickets 
          SET status = @status, updated_at = GETDATE()
          WHERE id IN (${ticket_ids.map((_, index) => `@id${index}`).join(', ')})
        `;
        updateParams.status = data.status;
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Geçersiz işlem türü' },
          { status: 400 }
        );
    }

    const request_db = pool.request();
    
    // Ticket ID'lerini parametreler olarak ekle
    ticket_ids.forEach((id: number, index: number) => {
      request_db.input(`id${index}`, id);
    });

    // Diğer parametreleri ekle
    Object.keys(updateParams).forEach(key => {
      request_db.input(key, updateParams[key]);
    });

    await request_db.query(updateQuery);

    // Güncellenmiş talepleri getir
    const selectQuery = `
      SELECT 
        cst.*,
        u.first_name + ' ' + u.last_name as customer_name,
        u.phone_number as customer_phone,
        u.email as customer_email
      FROM customer_support_tickets cst
      LEFT JOIN users u ON cst.user_id = u.id
      WHERE cst.id IN (${ticket_ids.map((_, index) => `@id${index}`).join(', ')})
    `;

    const selectRequest = pool.request();
    ticket_ids.forEach((id: number, index: number) => {
      selectRequest.input(`id${index}`, id);
    });

    const result = await selectRequest.query(selectQuery);

    return NextResponse.json({
      success: true,
      message: `${ticket_ids.length} müşteri destek talebi başarıyla güncellendi`,
      updated_count: ticket_ids.length,
      tickets: result.recordset
    });

  } catch (error: any) {
    console.error('Müşteri destek talepleri toplu güncelleme hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Müşteri destek talepleri güncellenemedi' },
      { status: 500 }
    );
  }
}