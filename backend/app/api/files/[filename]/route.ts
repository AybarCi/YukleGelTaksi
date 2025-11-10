import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    let { filename } = params;
    
    // Eğer filename uploads/ ile başlıyorsa, klasör yapısını koru
    if (filename.startsWith('uploads/')) {
      filename = filename.replace('uploads/', '');
    }
    
    // Validate filename (prevent directory traversal)
    if (!filename || filename.includes('..') || filename.includes('\\')) {
      return NextResponse.json(
        { error: 'Geçersiz dosya adı' },
        { status: 400 }
      );
    }

    // Eğer filename klasör yapısı içeriyorsa (örn: vehicle-type-photos/image.png)
    let filePath = join(process.cwd(), 'public', 'uploads', filename);
    
    // Dosya public/uploads altında yoksa, ana uploads klasöründe dene
    if (!existsSync(filePath)) {
      filePath = join(process.cwd(), 'uploads', filename);
    }
    
    // Hala bulunamadıysa, sadece dosya adıyla klasik klasörlerde dene
    if (!existsSync(filePath)) {
      // Sadece dosya adını al
      const fileNameOnly = filename.split('/').pop() || filename;
      
      // cargo-type-photos klasöründe dene
      const cargoTypePath = join(process.cwd(), 'public', 'uploads', 'cargo-type-photos', fileNameOnly);
      if (existsSync(cargoTypePath)) {
        filePath = cargoTypePath;
      } else {
        // vehicle-type-photos klasöründe dene
        const vehicleTypePath = join(process.cwd(), 'public', 'uploads', 'vehicle-type-photos', fileNameOnly);
        if (existsSync(vehicleTypePath)) {
          filePath = vehicleTypePath;
        } else {
          // cargo-photos klasöründe dene (eski dosyalar için)
          const cargoPath = join(process.cwd(), 'public', 'uploads', 'cargo-photos', fileNameOnly);
          if (existsSync(cargoPath)) {
            filePath = cargoPath;
          } else {
            // Ana uploads klasöründe dene
            const mainUploadsPath = join(process.cwd(), 'uploads', fileNameOnly);
            if (existsSync(mainUploadsPath)) {
              filePath = mainUploadsPath;
            }
          }
        }
      }
    }
    
    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Dosya bulunamadı' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await readFile(filePath);
    
    // Determine content type based on file extension
    const extension = filename.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg';
        break;
      case 'png':
        contentType = 'image/png';
        break;
      case 'webp':
        contentType = 'image/webp';
        break;
      case 'pdf':
        contentType = 'application/pdf';
        break;
      case 'doc':
        contentType = 'application/msword';
        break;
      case 'docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
    }

    return new NextResponse(fileBuffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });

  } catch (error) {
    console.error('File serve error:', error);
    return NextResponse.json(
      { error: 'Dosya okuma hatası' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}