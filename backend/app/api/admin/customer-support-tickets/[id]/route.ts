import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../../config/database';
import { authenticateSupervisorToken } from '../../../../../middleware/supervisorAuth';
import sql from 'mssql';

// GET - Belirli bir müşteri destek talebini getir
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Token doğrulama
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.message },
        { status: 401 }
      );
    }

    const ticketId = parseInt(params.id);
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz ticket ID' },
        { status: 400 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    const query = `
      SELECT 
        cst.*,
        u.first_name + ' ' + u.last_name as customer_name,
        u.phone_number as customer_phone,
        u.email as customer_email
      FROM customer_support_tickets cst
      LEFT JOIN users u ON cst.user_id = u.id
      WHERE cst.id = @ticketId AND u.user_type = 'customer'
    `;

    const result = await pool.request()
      .input('ticketId', sql.Int, ticketId)
      .query(query);

    if (result.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Müşteri destek talebi bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ticket: result.recordset[0]
    });

  } catch (error: any) {
    console.error('Müşteri destek talebi getirme hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Müşteri destek talebi alınamadı' },
      { status: 500 }
    );
  }
}

// PUT - Belirli bir müşteri destek talebini güncelle
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Token doğrulama
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.message },
        { status: 401 }
      );
    }

    const ticketId = parseInt(params.id);
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz ticket ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, admin_response, priority } = body;

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Önce talebin var olduğunu kontrol et
    const checkQuery = `
      SELECT cst.id 
      FROM customer_support_tickets cst
      LEFT JOIN users u ON cst.user_id = u.id
      WHERE cst.id = @ticketId AND u.user_type = 'customer'
    `;

    const checkResult = await pool.request()
      .input('ticketId', sql.Int, ticketId)
      .query(checkQuery);

    if (checkResult.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Müşteri destek talebi bulunamadı' },
        { status: 404 }
      );
    }

    // Güncelleme sorgusu oluştur
    let updateFields = [];
    let updateParams: any = { ticketId };

    if (status) {
      updateFields.push('status = @status');
      updateParams.status = status;
      
      if (status === 'resolved') {
        updateFields.push('resolved_at = GETDATE()');
      }
    }

    if (admin_response) {
      updateFields.push('admin_response = @admin_response');
      updateParams.admin_response = admin_response;
    }

    if (priority) {
      updateFields.push('priority = @priority');
      updateParams.priority = priority;
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Güncellenecek alan bulunamadı' },
        { status: 400 }
      );
    }

    updateFields.push('updated_at = GETDATE()');

    const updateQuery = `
      UPDATE customer_support_tickets 
      SET ${updateFields.join(', ')}
      WHERE id = @ticketId
    `;

    const updateRequest = pool.request();
    Object.keys(updateParams).forEach(key => {
      updateRequest.input(key, updateParams[key]);
    });

    await updateRequest.query(updateQuery);

    // Güncellenmiş talebi getir
    const selectQuery = `
      SELECT 
        cst.*,
        u.first_name + ' ' + u.last_name as customer_name,
        u.phone_number as customer_phone,
        u.email as customer_email
      FROM customer_support_tickets cst
      LEFT JOIN users u ON cst.user_id = u.id
      WHERE cst.id = @ticketId
    `;

    const result = await pool.request()
      .input('ticketId', sql.Int, ticketId)
      .query(selectQuery);

    return NextResponse.json({
      success: true,
      message: 'Müşteri destek talebi başarıyla güncellendi',
      ticket: result.recordset[0]
    });

  } catch (error: any) {
    console.error('Müşteri destek talebi güncelleme hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Müşteri destek talebi güncellenemedi' },
      { status: 500 }
    );
  }
}

// DELETE - Belirli bir müşteri destek talebini sil
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Token doğrulama
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.message },
        { status: 401 }
      );
    }

    const ticketId = parseInt(params.id);
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz ticket ID' },
        { status: 400 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Önce talebin var olduğunu kontrol et
    const checkQuery = `
      SELECT cst.id 
      FROM customer_support_tickets cst
      LEFT JOIN users u ON cst.user_id = u.id
      WHERE cst.id = @ticketId AND u.user_type = 'customer'
    `;

    const checkResult = await pool.request()
      .input('ticketId', sql.Int, ticketId)
      .query(checkQuery);

    if (checkResult.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Müşteri destek talebi bulunamadı' },
        { status: 404 }
      );
    }

    // Talebi sil
    const deleteQuery = 'DELETE FROM customer_support_tickets WHERE id = @ticketId';
    
    await pool.request()
      .input('ticketId', sql.Int, ticketId)
      .query(deleteQuery);

    return NextResponse.json({
      success: true,
      message: 'Müşteri destek talebi başarıyla silindi'
    });

  } catch (error: any) {
    console.error('Müşteri destek talebi silme hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Müşteri destek talebi silinemedi' },
      { status: 500 }
    );
  }
}