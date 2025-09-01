import DatabaseConnection from '../../../config/database';
import { authenticateToken } from '../../../middleware/auth';

interface CreateSupportTicketRequest {
  issue_type: string;
  subject: string;
  message: string;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  ticket?: any;
  tickets?: any[];
}

// POST - Create a new support ticket
export async function POST(request: Request): Promise<Response> {
  try {
    // Auth kontrolü
    const authResult = await authenticateToken(request as any);
    
    if (!authResult.success || !authResult.user) {
      const response: ApiResponse = { error: authResult.message || 'Yetkilendirme gerekli' };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body: CreateSupportTicketRequest = await request.json();
    const { issue_type, subject, message } = body;

    // Validate required fields
    if (!issue_type || !subject || !message) {
      const response: ApiResponse = { error: 'Sorun türü, konu ve mesaj gerekli' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate issue_type
    const validIssueTypes = ['technical', 'payment', 'order', 'account', 'other'];
    if (!validIssueTypes.includes(issue_type)) {
      const response: ApiResponse = { error: 'Geçersiz sorun türü' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Get driver_id from user_id
      const driverResult = await pool.request()
        .input('user_id', authResult.user.id)
        .query('SELECT id FROM drivers WHERE user_id = @user_id');

      if (driverResult.recordset.length === 0) {
        const response: ApiResponse = { error: 'Sürücü bulunamadı' };
        return new Response(JSON.stringify(response), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const driverId = driverResult.recordset[0].id;

      // Create support ticket
      const result = await pool.request()
        .input('driver_id', driverId)
        .input('issue_type', issue_type)
        .input('subject', subject)
        .input('message', message)
        .query(`
          INSERT INTO support_tickets (driver_id, issue_type, subject, message, status, priority)
          OUTPUT INSERTED.id, INSERTED.created_at
          VALUES (@driver_id, @issue_type, @subject, @message, 'open', 'medium')
        `);

      const ticketId = result.recordset[0].id;
      const createdAt = result.recordset[0].created_at;

      const response: ApiResponse = {
        success: true,
        message: 'Destek talebi başarıyla oluşturuldu',
        ticket: {
          id: ticketId,
          driver_id: driverId,
          issue_type,
          subject,
          message,
          status: 'open',
          priority: 'medium',
          created_at: createdAt
        }
      };

      return new Response(JSON.stringify(response), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (dbError) {
      console.error('Veritabanı hatası:', dbError);
      const response: ApiResponse = { error: 'Veritabanı hatası oluştu' };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Destek talebi oluşturma hatası:', error);
    const response: ApiResponse = { error: 'Destek talebi oluşturulurken bir hata oluştu' };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET - Get support tickets for a driver
export async function GET(request: Request): Promise<Response> {
  try {
    // Auth kontrolü
    const authResult = await authenticateToken(request as any);
    
    if (!authResult.success || !authResult.user) {
      const response: ApiResponse = { error: authResult.message || 'Yetkilendirme gerekli' };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Get driver_id from user_id
      const driverResult = await pool.request()
        .input('user_id', authResult.user.id)
        .query('SELECT id FROM drivers WHERE user_id = @user_id');

      if (driverResult.recordset.length === 0) {
        const response: ApiResponse = { error: 'Sürücü bulunamadı' };
        return new Response(JSON.stringify(response), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const driverId = driverResult.recordset[0].id;

      // Get support tickets for the driver
      const result = await pool.request()
        .input('driver_id', driverId)
        .query(`
          SELECT 
            id,
            issue_type,
            subject,
            message,
            status,
            priority,
            admin_response,
            resolved_at,
            created_at,
            updated_at
          FROM support_tickets 
          WHERE driver_id = @driver_id 
          ORDER BY created_at DESC
        `);

      const response: ApiResponse = {
        success: true,
        message: 'Destek talepleri başarıyla alındı',
        tickets: result.recordset
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (dbError) {
      console.error('Veritabanı hatası:', dbError);
      const response: ApiResponse = { error: 'Veritabanı hatası oluştu' };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Destek talepleri getirme hatası:', error);
    const response: ApiResponse = { error: 'Destek talepleri alınırken bir hata oluştu' };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// OPTIONS method for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}