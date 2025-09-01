import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '../../../../../middleware/auth';
import sql from 'mssql';
import DatabaseConnection from '../../../../../config/database';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    // Get user ID from authenticated user
    const userId = authResult.user.id;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('photo') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Profil fotoğrafı seçilmedi' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Geçersiz dosya formatı. Sadece JPEG, PNG ve WebP formatları desteklenir.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Dosya boyutu çok büyük. Maksimum 5MB olmalıdır.' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `profile_${userId}_${uuidv4()}.${fileExtension}`;
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }

    // Save file to uploads directory
    const filePath = join(uploadsDir, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    await writeFile(filePath, buffer);

    // Update user's profile_image_url in database
    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    const fileUrl = `/api/files/${fileName}`;
    
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('profileImageUrl', sql.NVarChar, fileUrl)
      .query(`
        UPDATE users 
        SET profile_image_url = @profileImageUrl, updated_at = GETDATE()
        WHERE id = @userId
      `);

    return NextResponse.json({
      success: true,
      message: 'Profil fotoğrafı başarıyla yüklendi',
      data: {
        profile_image_url: fileUrl
      }
    });

  } catch (error) {
    console.error('Profile photo upload error:', error);
    return NextResponse.json(
      { error: 'Profil fotoğrafı yüklenirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

// Get current profile photo
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    // Get user ID from authenticated user
    const userId = authResult.user.id;

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    // Get user's profile image URL
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT profile_image_url
        FROM users 
        WHERE id = @userId
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    const profileImageUrl = result.recordset[0].profile_image_url;

    return NextResponse.json({
      success: true,
      data: {
        profile_image_url: profileImageUrl
      }
    });

  } catch (error) {
    console.error('Get profile photo error:', error);
    return NextResponse.json(
      { error: 'Profil fotoğrafı alınırken bir hata oluştu' },
      { status: 500 }
    );
  }
}

// Delete profile photo
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    // Get user ID from authenticated user
    const userId = authResult.user.id;

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    // Remove profile image URL from database
    await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        UPDATE users 
        SET profile_image_url = NULL, updated_at = GETDATE()
        WHERE id = @userId
      `);

    return NextResponse.json({
      success: true,
      message: 'Profil fotoğrafı başarıyla silindi'
    });

  } catch (error) {
    console.error('Delete profile photo error:', error);
    return NextResponse.json(
      { error: 'Profil fotoğrafı silinirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}