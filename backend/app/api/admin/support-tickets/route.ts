import DatabaseConnection from '../../../../config/database';
import { authenticateSupervisorToken } from '../../../../middleware/supervisorAuth';

interface UpdateSupportTicketRequest {
  status?: string;
  admin_response?: string;
  priority?: string;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  ticket?: any;
  tickets?: any[];
}

// GET - Get all support tickets for admin
export async function GET(request: Request): Promise<Response> {
  try {
    // Admin auth kontrolü
    const authResult = await authenticateSupervisorToken(request as any);
    
    if (!authResult.success || !authResult.supervisor) {
      const response: ApiResponse = { error: authResult.message || 'Admin yetkilendirmesi gerekli' };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Get all support tickets with driver information
      const result = await pool.request()
        .query(`
          SELECT 
            st.id,
            st.driver_id,
            st.issue_type,
            st.subject,
            st.message,
            st.status,
            st.priority,
            st.admin_response,
            st.resolved_at,
            st.created_at,
            st.updated_at,
            d.first_name + ' ' + d.last_name as driver_name,
            u.phone_number as driver_phone
          FROM support_tickets st
          LEFT JOIN drivers d ON st.driver_id = d.id
          LEFT JOIN users u ON d.user_id = u.id
          ORDER BY st.created_at DESC
        `);

      const response: ApiResponse = {
        success: true,
        tickets: result.recordset
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (dbError: any) {
      console.error('Database error:', dbError);
      const response: ApiResponse = { error: 'Veritabanı hatası' };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('Admin support tickets GET error:', error);
    const response: ApiResponse = { error: 'Sunucu hatası' };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// PUT - Update support ticket (for specific ticket ID)
export async function PUT(request: Request): Promise<Response> {
  try {
    // Admin auth kontrolü
    const authResult = await authenticateSupervisorToken(request as any);
    
    if (!authResult.success || !authResult.supervisor) {
      const response: ApiResponse = { error: authResult.message || 'Admin yetkilendirmesi gerekli' };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get ticket ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const ticketId = pathParts[pathParts.length - 1];

    if (!ticketId || isNaN(Number(ticketId))) {
      const response: ApiResponse = { error: 'Geçersiz destek talebi ID' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body: UpdateSupportTicketRequest = await request.json();
    const { status, admin_response, priority } = body;

    if (!status && !admin_response && !priority) {
      const response: ApiResponse = { error: 'Güncellenecek alan belirtilmedi' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Check if ticket exists
      const checkResult = await pool.request()
        .input('ticket_id', Number(ticketId))
        .query('SELECT id FROM support_tickets WHERE id = @ticket_id');

      if (checkResult.recordset.length === 0) {
        const response: ApiResponse = { error: 'Destek talebi bulunamadı' };
        return new Response(JSON.stringify(response), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Build update query dynamically
      let updateQuery = 'UPDATE support_tickets SET ';
      const updateFields: string[] = [];
      const request_obj = pool.request().input('ticket_id', Number(ticketId));

      if (status) {
        updateFields.push('status = @status');
        request_obj.input('status', status);
        
        // If status is resolved, set resolved_at
        if (status === 'resolved') {
          updateFields.push('resolved_at = GETDATE()');
        }
      }

      if (admin_response) {
        updateFields.push('admin_response = @admin_response');
        request_obj.input('admin_response', admin_response);
      }

      if (priority) {
        updateFields.push('priority = @priority');
        request_obj.input('priority', priority);
      }

      updateFields.push('updated_at = GETDATE()');
      updateQuery += updateFields.join(', ') + ' WHERE id = @ticket_id';

      await request_obj.query(updateQuery);

      // Get updated ticket
      const updatedResult = await pool.request()
        .input('ticket_id', Number(ticketId))
        .query(`
          SELECT 
            st.id,
            st.driver_id,
            st.issue_type,
            st.subject,
            st.message,
            st.status,
            st.priority,
            st.admin_response,
            st.resolved_at,
            st.created_at,
            st.updated_at,
            d.first_name + ' ' + d.last_name as driver_name,
            u.phone_number as driver_phone
          FROM support_tickets st
          LEFT JOIN drivers d ON st.driver_id = d.id
          LEFT JOIN users u ON d.user_id = u.id
          WHERE st.id = @ticket_id
        `);

      const response: ApiResponse = {
        success: true,
        message: 'Destek talebi başarıyla güncellendi',
        ticket: updatedResult.recordset[0]
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (dbError: any) {
      console.error('Database error:', dbError);
      const response: ApiResponse = { error: 'Veritabanı hatası' };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('Admin support ticket PUT error:', error);
    const response: ApiResponse = { error: 'Sunucu hatası' };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}