import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { authenticateToken } from '../../../../middleware/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string[] } }
) {
  try {
    let filename = params.filename.join('/');
    
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

    // Yeni yapı: app/api/files altında doğrudan klasörler
    let filePath = join(process.cwd(), 'app', 'api', 'files', filename);
    
    // Hala bulunamadıysa, sadece dosya adıyla klasik klasörlerde dene
    if (!existsSync(filePath)) {
      // Sadece dosya adını al
      const fileNameOnly = filename.split('/').pop() || filename;
      
      // vehicle-type-photos klasöründe dene (yeni yapı)
      const vehicleTypePath = join(process.cwd(), 'app', 'api', 'files', 'vehicle-type-photos', fileNameOnly);
      if (existsSync(vehicleTypePath)) {
        filePath = vehicleTypePath;
      } else {
        // cargo-type-photos klasöründe dene (yeni yapı)
        const cargoTypePath = join(process.cwd(), 'app', 'api', 'files', 'cargo-type-photos', fileNameOnly);
        if (existsSync(cargoTypePath)) {
          filePath = cargoTypePath;
        } else {
          // Eski yapı için geriye dönük uyumluluk
          const oldPublicPath = join(process.cwd(), 'public', 'uploads', filename);
          if (existsSync(oldPublicPath)) {
            filePath = oldPublicPath;
          } else {
            // Eski klasik klasörlerde dene
            const oldVehicleTypePath = join(process.cwd(), 'public', 'uploads', 'vehicle-type-photos', fileNameOnly);
            if (existsSync(oldVehicleTypePath)) {
              filePath = oldVehicleTypePath;
            } else {
              const oldCargoTypePath = join(process.cwd(), 'public', 'uploads', 'cargo-type-photos', fileNameOnly);
              if (existsSync(oldCargoTypePath)) {
                filePath = oldCargoTypePath;
              }
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