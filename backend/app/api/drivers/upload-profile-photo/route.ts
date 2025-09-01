import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '../../../../middleware/auth';
import DatabaseConnection from '../../../../config/database';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sql from 'mssql';

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

    // Parse FormData
    const formData = await request.formData();
    const profilePhotoFile = formData.get('profile_photo') as File;

    if (!profilePhotoFile || profilePhotoFile.size === 0) {
      return NextResponse.json(
        { error: 'Profil fotoğrafı gerekli' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(profilePhotoFile.type)) {
      return NextResponse.json(
        { error: 'Sadece JPEG, PNG ve WebP formatları desteklenir' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (profilePhotoFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Dosya boyutu 5MB\'dan küçük olmalıdır' },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }

    // Generate unique filename
    const fileExtension = profilePhotoFile.name.split('.').pop() || 'jpg';
    const fileName = `profile_${userId}_${uuidv4()}.${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);

    // Save file to disk
    const buffer = Buffer.from(await profilePhotoFile.arrayBuffer());
    await writeFile(filePath, buffer);

    // Update database
    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();

    // Update driver's profile photo
    const updateResult = await pool.request()
      .input('userId', sql.Int, userId)
      .input('profilePhoto', sql.VarChar, fileName)
      .query(`
        UPDATE drivers 
        SET driver_photo = @profilePhoto,
            updated_at = GETDATE()
        WHERE user_id = @userId
      `);

    if (updateResult.rowsAffected[0] === 0) {
      return NextResponse.json(
        { error: 'Sürücü profili bulunamadı' },
        { status: 404 }
      );
    }

    // Return success response with file URL
    const fileUrl = `/api/files/${fileName}`;
    
    return NextResponse.json({
      success: true,
      message: 'Profil fotoğrafı başarıyla yüklendi',
      data: {
        profile_image: fileName,
        profile_image_url: fileUrl
      }
    });

  } catch (error) {
    console.error('Profil fotoğrafı yükleme hatası:', error);
    return NextResponse.json(
      { error: 'Profil fotoğrafı yüklenirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}