import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { authenticateSupervisorToken } from '../../../../middleware/supervisorAuth';

// POST - Upload vehicle type image
export async function POST(request: NextRequest) {
  try {
    // Admin yetkisi kontrolü
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Dosya bulunamadı' },
        { status: 400 }
      );
    }

    // Dosya türü kontrolü
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Sadece JPEG, PNG ve WebP dosyaları kabul edilir' },
        { status: 400 }
      );
    }

    // Dosya boyutu kontrolü (5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'Dosya boyutu 5MB\'dan büyük olamaz' },
        { status: 400 }
      );
    }

    // Upload klasörünü oluştur
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'vehicle-type-photos');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Dosya adını oluştur (timestamp + original name)
    const timestamp = Date.now();
    const fileExtension = path.extname(file.name);
    const fileName = `vehicle-type-${timestamp}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);

    // Dosyayı kaydet
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // URL path'i oluştur
    const imageUrl = `/uploads/vehicle-type-photos/${fileName}`;

    return NextResponse.json({
      success: true,
      message: 'Fotoğraf başarıyla yüklendi',
      data: {
        imageUrl,
        fileName,
        fileSize: file.size,
        fileType: file.type
      }
    });

  } catch (error) {
    console.error('Vehicle type image upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Fotoğraf yüklenirken hata oluştu' },
      { status: 500 }
    );
  }
}

// OPTIONS - CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}