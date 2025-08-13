import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupervisorToken } from '../../../../middleware/supervisorAuth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    // Authenticate supervisor
    const authResult = await authenticateSupervisorToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const files: { [key: string]: string } = {};
    
    // Ensure uploads directory exists
    const uploadsDir = join(process.cwd(), 'uploads');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Process each file
    const entries = Array.from(formData.entries());
    for (const [key, value] of entries) {
      if (value instanceof File && value.size > 0) {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(value.type)) {
          return NextResponse.json(
            { error: `Geçersiz dosya tipi: ${value.type}. Sadece JPEG, PNG, WebP ve PDF dosyaları kabul edilir.` },
            { status: 400 }
          );
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (value.size > maxSize) {
          return NextResponse.json(
            { error: `Dosya boyutu çok büyük. Maksimum 5MB olmalıdır.` },
            { status: 400 }
          );
        }

        // Generate unique filename
        const fileExtension = value.name.split('.').pop();
        const uniqueFilename = `${uuidv4()}.${fileExtension}`;
        const filePath = join(uploadsDir, uniqueFilename);

        // Convert file to buffer and save
        const bytes = await value.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Store the filename for response
        files[key] = uniqueFilename;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Dosyalar başarıyla yüklendi',
      data: { files }
    }, { status: 200 });

  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Dosya yükleme sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}

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