import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { authenticateSupervisorToken } from '../../../../middleware/supervisorAuth';

export async function POST(request: NextRequest) {
  try {
    // Auth kontrolü
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
    }

    const data = await request.formData();
    const file = data.get('image') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'Resim dosyası gerekli' }, { status: 400 });
    }

    // Dosya kontrolü
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Sadece resim dosyaları kabul edilir' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      return NextResponse.json({ error: 'Dosya boyutu 5MB\'yi geçemez' }, { status: 400 });
    }

    // Klasör oluştur
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'vehicle-types');
    await mkdir(uploadDir, { recursive: true });

    // Dosya adı oluştur
    const timestamp = Date.now();
    const fileName = `vehicle-type-${timestamp}${path.extname(file.name)}`;
    const filePath = path.join(uploadDir, fileName);

    // Dosyayı kaydet
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // URL oluştur
    const imageUrl = `/uploads/vehicle-types/${fileName}`;

    return NextResponse.json({ 
      success: true, 
      imageUrl,
      fileName 
    });

  } catch (error) {
    console.error('Resim yükleme hatası:', error);
    return NextResponse.json({ error: 'Resim yüklenirken hata oluştu' }, { status: 500 });
  }
}