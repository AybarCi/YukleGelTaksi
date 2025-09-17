import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import { authenticateToken } from '../../../../middleware/auth';
import { writeFile, mkdir } from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import SocketServer from '../../../../socket/socketServer';

interface CreateOrderRequest {
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  distance: number;
  estimatedTime: number;
  notes?: string;
  vehicle_type_id: number;
  laborRequired?: boolean;
  laborCount?: number;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  order?: any;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    
    // Backend'e gelen request'i logla
    console.log('=== BACKEND REQUEST LOG ===');
    console.log('User ID:', authResult.user.id);
    console.log('FormData entries:');
    for (const [key, value] of (formData as any).entries()) {
      if (value instanceof File) {
        console.log(`${key}: File (name: ${value.name}, size: ${value.size}, type: ${value.type})`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }
    console.log('==============================');
    
    // Extract form fields
    const pickupAddress = (formData as any).get('pickupAddress')?.toString() || '';
    const pickupLatitude = parseFloat((formData as any).get('pickupLatitude')?.toString() || '0');
    const pickupLongitude = parseFloat((formData as any).get('pickupLongitude')?.toString() || '0');
    const destinationAddress = (formData as any).get('destinationAddress')?.toString() || '';
    const destinationLatitude = parseFloat((formData as any).get('destinationLatitude')?.toString() || '0');
    const destinationLongitude = parseFloat((formData as any).get('destinationLongitude')?.toString() || '0');
    const distance = parseFloat((formData as any).get('distance')?.toString() || '0');
    const estimatedTime = parseInt((formData as any).get('estimatedTime')?.toString() || '0');
    const notes = (formData as any).get('notes')?.toString() || '';
    const vehicle_type_id = parseInt((formData as any).get('vehicle_type_id')?.toString() || '0');
    const weight_kg = parseFloat((formData as any).get('weight_kg')?.toString() || '0');
    const laborRequired = ((formData as any).get('laborRequired') as FormDataEntryValue)?.toString() === 'true';
    const laborCount = parseInt(((formData as any).get('laborCount') as FormDataEntryValue)?.toString() || '0');
    // Handle multiple cargo photos
    const cargoPhotos: File[] = [];
    let photoIndex = 0;
    while (true) {
      const photo = (formData as any).get(`cargoPhoto${photoIndex}`) as FormDataEntryValue;
      if (!photo || !(photo instanceof File) || photo.size === 0) break;
      cargoPhotos.push(photo);
      photoIndex++;
    }
    
    // Fallback to single photo for backward compatibility
    const singleCargoPhoto = (formData as any).get('cargoPhoto') as FormDataEntryValue;
    if (singleCargoPhoto && singleCargoPhoto instanceof File && singleCargoPhoto.size > 0) {
      cargoPhotos.push(singleCargoPhoto);
    }

    // Validate required fields
    if (!pickupAddress || !destinationAddress || cargoPhotos.length === 0 || !vehicle_type_id) {
      return NextResponse.json(
        { success: false, error: 'Gerekli alanlar eksik' },
        { status: 400 }
      );
    }

    if (isNaN(pickupLatitude) || isNaN(pickupLongitude) || 
        isNaN(destinationLatitude) || isNaN(destinationLongitude) ||
        isNaN(distance) || isNaN(estimatedTime)) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz koordinat veya mesafe bilgisi' },
        { status: 400 }
      );
    }

    // Save cargo photos
    const cargoPhotoUrls: string[] = [];
    if (cargoPhotos.length > 0) {
      try {
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'cargo-photos');
        await mkdir(uploadsDir, { recursive: true });
        
        for (const photo of cargoPhotos) {
          const bytes = await photo.arrayBuffer();
          const buffer = Buffer.from(bytes);
          
          // Generate unique filename
          const fileExtension = photo.name.split('.').pop() || 'jpg';
          const fileName = `${uuidv4()}.${fileExtension}`;
          const filePath = path.join(uploadsDir, fileName);
          
          // Save file
          await writeFile(filePath, buffer);
          cargoPhotoUrls.push(`/uploads/cargo-photos/${fileName}`);
        }
      } catch (error) {
        console.error('File upload error:', error);
        return NextResponse.json(
          { success: false, error: 'Fotoğraf yüklenirken hata oluştu' },
          { status: 500 }
        );
      }
    }

    // Calculate price using the pricing API
    let priceCalculation;
    try {
      const priceResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/calculate-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('Authorization') || ''
        },
        body: JSON.stringify({
          distance_km: distance,
          vehicle_type_id: vehicle_type_id,
          labor_count: laborCount || 0
        })
      });
      
      if (!priceResponse.ok) {
        throw new Error('Price calculation failed');
      }
      
      const priceData = await priceResponse.json();
      priceCalculation = priceData.data;
    } catch (priceError) {
      console.error('Price calculation error:', priceError);
      return NextResponse.json(
        { success: false, error: 'Fiyat hesaplama sırasında hata oluştu' },
        { status: 500 }
      );
    }

    // Connect to database
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Create order
    const result = await pool.request()
      .input('user_id', authResult.user.id)
      .input('pickup_address', pickupAddress)
      .input('pickup_latitude', pickupLatitude)
      .input('pickup_longitude', pickupLongitude)
      .input('destination_address', destinationAddress)
      .input('destination_latitude', destinationLatitude)
      .input('destination_longitude', destinationLongitude)
      .input('cargo_photo_urls', JSON.stringify(cargoPhotoUrls))
      .input('customer_notes', notes)
      .input('distance_km', distance)
      .input('weight_kg', weight_kg)
      .input('vehicle_type_id', vehicle_type_id)
      .input('labor_count', laborCount)
      .input('base_price', priceCalculation.base_price)
      .input('distance_price', priceCalculation.distance_price)
      .input('labor_price', priceCalculation.labor_price)
      .input('total_price', priceCalculation.total_price)
      .query(`
        INSERT INTO orders (
          user_id, pickup_address, pickup_latitude, pickup_longitude,
          destination_address, destination_latitude, destination_longitude,
          cargo_photo_urls, customer_notes, distance_km, weight_kg,
          vehicle_type_id, labor_count, base_price, distance_price,
          labor_price, total_price, status, created_at
        )
        OUTPUT INSERTED.id, INSERTED.created_at
        VALUES (
          @user_id, @pickup_address, @pickup_latitude, @pickup_longitude,
          @destination_address, @destination_latitude, @destination_longitude,
          @cargo_photo_urls, @customer_notes, @distance_km, @weight_kg,
          @vehicle_type_id, @labor_count, @base_price, @distance_price,
          @labor_price, @total_price, 'pending', GETDATE()
        )
      `);

    const newOrder = result.recordset[0];

    // Log order status change (skip if table doesn't exist)
    try {
      await pool.request()
        .input('order_id', newOrder.id)
        .input('new_status', 'pending')
        .input('changed_by_user_id', authResult.user.id)
        .query(`
          INSERT INTO order_status_history (
            order_id, old_status, new_status, changed_by_user_id, created_at
          )
          VALUES (
            @order_id, NULL, @new_status, @changed_by_user_id, GETDATE()
          )
        `);
    } catch (historyError) {
      console.log('Order status history table not found, skipping history log');
    }

    // Socket.IO ile yakındaki sürücülere bildirim gönder
    try {
      const socketServer = global.socketServer as SocketServer;
      if (socketServer) {
        const orderData = {
          pickupAddress,
          pickupLatitude,
          pickupLongitude,
          destinationAddress,
          destinationLatitude,
          destinationLongitude,
          vehicle_type_id: vehicle_type_id,
          laborCount: laborCount || 0,
          estimatedPrice: priceCalculation.total_price
        };
        
        await socketServer.broadcastOrderToNearbyDrivers(newOrder.id, orderData);
        console.log(`Order ${newOrder.id} broadcasted to nearby drivers`);
      }
    } catch (socketError) {
      console.error('Socket broadcast error:', socketError);
      // Socket hatası sipariş oluşturmayı engellemez
    }

    const response: ApiResponse = {
      success: true,
      message: 'Sipariş başarıyla oluşturuldu',
      order: {
        id: newOrder.id,
        pickupAddress,
        destinationAddress,
        distance,
        estimatedTime,
        estimatedPrice: priceCalculation.total_price,
        status: 'pending',
        createdAt: newOrder.created_at
      }
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { success: false, error: 'Sipariş oluşturulurken hata oluştu' },
      { status: 500 }
    );
  }
}

// OPTIONS method for CORS
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