import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params;
    
    // Güvenlik kontrolü - sadece izin verilen karakterler
    if (!filename.match(/^[a-zA-Z0-9._-]+$/)) {
      return NextResponse.json({ error: 'Geçersiz dosya adı' }, { status: 400 });
    }
    
    // Dosya yolunu oluştur
    const filePath = path.join('/tmp', 'vehicle-type-photos', filename);
    
    // Dosyanın varlığını kontrol et
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 404 });
    }
    
    // Dosyayı oku
    const fileBuffer = await readFile(filePath);
    
    // Content-Type başlığını belirle
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
    }
    
    // Dosyayı response olarak gönder
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // 1 saat cache
      },
    });
    
  } catch (error) {
    console.error('Dosya servis hatası:', error);
    return NextResponse.json({ error: 'Dosya servis edilemedi' }, { status: 500 });
  }
}