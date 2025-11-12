import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../../config/database';
import { authenticateSupervisorToken } from '../../../../../middleware/supervisorAuth';

// OPTIONS - CORS preflight istekleri için
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

interface BulkUpdateRequest {
  ticket_ids: number[];
  action: 'take' | 'resolve' | 'update_priority' | 'update_status';
  data?: {
    status?: string;
    priority?: string;
    admin_response?: string;
  };
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  updated_count?: number;
  tickets?: any[];
}

// POST - Bulk operations on support tickets
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Admin auth kontrolü
    const authResult = await authenticateSupervisorToken(request);
    
    if (!authResult.success || !authResult.supervisor) {
      return NextResponse.json(
        { error: authResult.message || 'Admin yetkilendirmesi gerekli' },
        { status: 401 }
      );
    }

    const body: BulkUpdateRequest = await request.json();
    const { ticket_ids, action, data } = body;

    if (!ticket_ids || !Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return NextResponse.json(
        { error: 'Geçerli ticket ID listesi gerekli' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'İşlem türü belirtilmedi' },
        { status: 400 }
      );
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      let updateQuery = '';
      let updateFields: string[] = [];
      let successMessage = '';

      // Build query based on action
      switch (action) {
        case 'take':
          updateFields = [
            'status = @status',
            'updated_at = GETDATE()'
          ];
          successMessage = 'Destek talepleri işleme alındı';
          break;

        case 'resolve':
          updateFields = [
            'status = @status',
            'resolved_at = GETDATE()',
            'updated_at = GETDATE()'
          ];
          if (data?.admin_response) {
            updateFields.push('admin_response = @admin_response');
          }
          successMessage = 'Destek talepleri çözüldü olarak işaretlendi';
          break;

        case 'update_priority':
          if (!data?.priority) {
            return NextResponse.json(
              { error: 'Öncelik değeri gerekli' },
              { status: 400 }
            );
          }
          updateFields = [
            'priority = @priority',
            'updated_at = GETDATE()'
          ];
          successMessage = 'Destek talepleri önceliği güncellendi';
          break;

        case 'update_status':
          if (!data?.status) {
            return NextResponse.json(
              { error: 'Durum değeri gerekli' },
              { status: 400 }
            );
          }
          updateFields = [
            'status = @status',
            'updated_at = GETDATE()'
          ];
          if (data.status === 'resolved') {
            updateFields.push('resolved_at = GETDATE()');
          }
          successMessage = 'Destek talepleri durumu güncellendi';
          break;

        default:
          return NextResponse.json(
            { error: 'Geçersiz işlem türü' },
            { status: 400 }
          );
      }

      // Create placeholders for ticket IDs
      const ticketPlaceholders = ticket_ids.map((_, index) => `@ticket_id_${index}`).join(', ');
      updateQuery = `UPDATE support_tickets SET ${updateFields.join(', ')} WHERE id IN (${ticketPlaceholders})`;

      const request_obj = pool.request();

      // Add ticket ID parameters
      ticket_ids.forEach((id, index) => {
        request_obj.input(`ticket_id_${index}`, Number(id));
      });

      // Add data parameters based on action
      switch (action) {
        case 'take':
          request_obj.input('status', 'in_progress');
          break;
        case 'resolve':
          request_obj.input('status', 'resolved');
          if (data?.admin_response) {
            request_obj.input('admin_response', data.admin_response);
          }
          break;
        case 'update_priority':
          request_obj.input('priority', data!.priority);
          break;
        case 'update_status':
          request_obj.input('status', data!.status);
          break;
      }

      // Execute update
      const updateResult = await request_obj.query(updateQuery);
      const updatedCount = updateResult.rowsAffected[0];

      if (updatedCount === 0) {
        return NextResponse.json(
          { error: 'Hiçbir destek talebi güncellenmedi' },
          { status: 404 }
        );
      }

      // Get updated tickets
      const getUpdatedRequest = pool.request();
      ticket_ids.forEach((id, index) => {
        getUpdatedRequest.input(`get_ticket_id_${index}`, Number(id));
      });

      const getTicketPlaceholders = ticket_ids.map((_, index) => `@get_ticket_id_${index}`).join(', ');
      const updatedTickets = await getUpdatedRequest.query(`
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
          u.phone_number as driver_phone,
          u.email as driver_email
        FROM support_tickets st
        LEFT JOIN drivers d ON st.driver_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        WHERE st.id IN (${getTicketPlaceholders})
        ORDER BY st.updated_at DESC
      `);

      return NextResponse.json({
        success: true,
        message: successMessage,
        updated_count: updatedCount,
        tickets: updatedTickets.recordset
      });

    } catch (dbError: any) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Veritabanı hatası' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Admin support tickets bulk error:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}