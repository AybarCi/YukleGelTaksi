import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../../config/database';
import { authenticateSupervisorToken } from '../../../../../middleware/supervisorAuth';

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
}

// GET - Get specific support ticket by ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    // Admin auth kontrolü
    const authResult = await authenticateSupervisorToken(request);
    
    if (!authResult.success || !authResult.supervisor) {
      return NextResponse.json(
        { error: authResult.message || 'Admin yetkilendirmesi gerekli' },
        { status: 401 }
      );
    }

    const ticketId = params.id;

    if (!ticketId || isNaN(Number(ticketId))) {
      return NextResponse.json(
        { error: 'Geçersiz destek talebi ID' },
        { status: 400 }
      );
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Get specific support ticket with driver information
      const result = await pool.request()
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
            u.phone_number as driver_phone,
            u.email as driver_email
          FROM support_tickets st
          LEFT JOIN drivers d ON st.driver_id = d.id
          LEFT JOIN users u ON d.user_id = u.id
          WHERE st.id = @ticket_id
        `);

      if (result.recordset.length === 0) {
        return NextResponse.json(
          { error: 'Destek talebi bulunamadı' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        ticket: result.recordset[0]
      });

    } catch (dbError: any) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Veritabanı hatası' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Admin support ticket GET error:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

// PUT - Update specific support ticket
export async function PUT(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    // Admin auth kontrolü
    const authResult = await authenticateSupervisorToken(request);
    
    if (!authResult.success || !authResult.supervisor) {
      return NextResponse.json(
        { error: authResult.message || 'Admin yetkilendirmesi gerekli' },
        { status: 401 }
      );
    }

    const ticketId = params.id;

    if (!ticketId || isNaN(Number(ticketId))) {
      return NextResponse.json(
        { error: 'Geçersiz destek talebi ID' },
        { status: 400 }
      );
    }

    const body: UpdateSupportTicketRequest = await request.json();
    const { status, admin_response, priority } = body;

    if (!status && !admin_response && !priority) {
      return NextResponse.json(
        { error: 'Güncellenecek alan belirtilmedi' },
        { status: 400 }
      );
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Check if ticket exists
      const checkResult = await pool.request()
        .input('ticket_id', Number(ticketId))
        .query('SELECT id FROM support_tickets WHERE id = @ticket_id');

      if (checkResult.recordset.length === 0) {
        return NextResponse.json(
          { error: 'Destek talebi bulunamadı' },
          { status: 404 }
        );
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
            u.phone_number as driver_phone,
            u.email as driver_email
          FROM support_tickets st
          LEFT JOIN drivers d ON st.driver_id = d.id
          LEFT JOIN users u ON d.user_id = u.id
          WHERE st.id = @ticket_id
        `);

      return NextResponse.json({
        success: true,
        message: 'Destek talebi başarıyla güncellendi',
        ticket: updatedResult.recordset[0]
      });

    } catch (dbError: any) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Veritabanı hatası' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Admin support ticket PUT error:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

// DELETE - Delete specific support ticket (optional)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    // Admin auth kontrolü
    const authResult = await authenticateSupervisorToken(request);
    
    if (!authResult.success || !authResult.supervisor) {
      return NextResponse.json(
        { error: authResult.message || 'Admin yetkilendirmesi gerekli' },
        { status: 401 }
      );
    }

    const ticketId = params.id;

    if (!ticketId || isNaN(Number(ticketId))) {
      return NextResponse.json(
        { error: 'Geçersiz destek talebi ID' },
        { status: 400 }
      );
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Check if ticket exists
      const checkResult = await pool.request()
        .input('ticket_id', Number(ticketId))
        .query('SELECT id FROM support_tickets WHERE id = @ticket_id');

      if (checkResult.recordset.length === 0) {
        return NextResponse.json(
          { error: 'Destek talebi bulunamadı' },
          { status: 404 }
        );
      }

      // Delete the ticket
      await pool.request()
        .input('ticket_id', Number(ticketId))
        .query('DELETE FROM support_tickets WHERE id = @ticket_id');

      return NextResponse.json({
        success: true,
        message: 'Destek talebi başarıyla silindi'
      });

    } catch (dbError: any) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Veritabanı hatası' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Admin support ticket DELETE error:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}