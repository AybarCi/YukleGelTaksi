import DatabaseConnection from '../../../config/database';
import { authenticateToken } from '../../../middleware/auth';

interface CreateCustomerSupportTicketRequest {
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

// POST - Create a new customer support ticket
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

    const body: CreateCustomerSupportTicketRequest = await request.json();
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

      // Check if user is a customer
      const userResult = await pool.request()
        .input('user_id', authResult.user.id)
        .query('SELECT id, user_type FROM users WHERE id = @user_id');

      if (userResult.recordset.length === 0) {
        const response: ApiResponse = { error: 'Kullanıcı bulunamadı' };
        return new Response(JSON.stringify(response), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const user = userResult.recordset[0];
      if (user.user_type !== 'customer') {
        const response: ApiResponse = { error: 'Bu endpoint sadece müşteriler için kullanılabilir' };
        return new Response(JSON.stringify(response), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create customer support ticket
      const result = await pool.request()
        .input('user_id', authResult.user.id)
        .input('issue_type', issue_type)
        .input('subject', subject)
        .input('message', message)
        .query(`
          INSERT INTO customer_support_tickets (user_id, issue_type, subject, message, status, priority)
          OUTPUT INSERTED.id, INSERTED.created_at
          VALUES (@user_id, @issue_type, @subject, @message, 'open', 'medium')
        `);

      const ticketId = result.recordset[0].id;
      const createdAt = result.recordset[0].created_at;

      const response: ApiResponse = {
        success: true,
        message: 'Destek talebi başarıyla oluşturuldu',
        ticket: {
          id: ticketId,
          user_id: authResult.user.id,
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
    console.error('Müşteri destek talebi oluşturma hatası:', error);
    const response: ApiResponse = { error: 'Destek talebi oluşturulurken bir hata oluştu' };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET - Get customer support tickets
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

      // Check if user is a customer
      const userResult = await pool.request()
        .input('user_id', authResult.user.id)
        .query('SELECT id, user_type FROM users WHERE id = @user_id');

      if (userResult.recordset.length === 0) {
        const response: ApiResponse = { error: 'Kullanıcı bulunamadı' };
        return new Response(JSON.stringify(response), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const user = userResult.recordset[0];
      if (user.user_type !== 'customer') {
        const response: ApiResponse = { error: 'Bu endpoint sadece müşteriler için kullanılabilir' };
        return new Response(JSON.stringify(response), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get customer support tickets
      const result = await pool.request()
        .input('user_id', authResult.user.id)
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
          FROM customer_support_tickets 
          WHERE user_id = @user_id 
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
    console.error('Müşteri destek talepleri getirme hatası:', error);
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