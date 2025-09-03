import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import { authenticateToken } from '../../../../middleware/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import SocketServer from '../../../../socket/socketServer';

// Global socketServer tip tanımı
declare global {
  var socketServer: SocketServer | undefined;
}

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
  weightKg?: number;
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
    
    // Extract form fields
    const pickupAddress = formData.get('pickupAddress') as string;
    const pickupLatitude = parseFloat(formData.get('pickupLatitude') as string);
    const pickupLongitude = parseFloat(formData.get('pickupLongitude') as string);
    const destinationAddress = formData.get('destinationAddress') as string;
    const destinationLatitude = parseFloat(formData.get('destinationLatitude') as string);
    const destinationLongitude = parseFloat(formData.get('destinationLongitude') as string);
    const distance = parseFloat(formData.get('distance') as string);
    const estimatedTime = parseInt(formData.get('estimatedTime') as string);
    const notes = formData.get('notes') as string || '';
    const weightKg = parseFloat(formData.get('weightKg') as string) || 0;
    const laborRequired = formData.get('laborRequired') === 'true';
    const laborCount = parseInt(formData.get('laborCount') as string) || 0;
    const cargoPhoto = formData.get('cargoPhoto') as File;

    // Validate required fields
    if (!pickupAddress || !destinationAddress || !cargoPhoto) {
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

    // Save cargo photo
    let cargoPhotoUrl = '';
    if (cargoPhoto && cargoPhoto.size > 0) {
      try {
        const bytes = await cargoPhoto.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'cargo-photos');
        await mkdir(uploadsDir, { recursive: true });
        
        // Generate unique filename
        const fileExtension = cargoPhoto.name.split('.').pop() || 'jpg';
        const fileName = `${uuidv4()}.${fileExtension}`;
        const filePath = path.join(uploadsDir, fileName);
        
        // Save file
        await writeFile(filePath, buffer);
        cargoPhotoUrl = `/uploads/cargo-photos/${fileName}`;
      } catch (error) {
        console.error('File upload error:', error);
        return NextResponse.json(
          { success: false, error: 'Fotoğraf yüklenirken hata oluştu' },
          { status: 500 }
        );
      }
    }

    // Calculate estimated price (basic calculation)
    const basePrice = 50; // Base price in TL
    const pricePerKm = 5; // Price per km in TL
    const laborPrice = laborRequired ? (laborCount * 25) : 0; // Labor price per person
    const weightPrice = weightKg > 10 ? (weightKg - 10) * 2 : 0; // Extra price for weight > 10kg
    
    const estimatedPrice = basePrice + (distance * pricePerKm) + laborPrice + weightPrice;

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
      .input('cargo_photo_url', cargoPhotoUrl)
      .input('customer_notes', notes)
      .input('distance_km', distance)
      .input('weight_kg', weightKg)
      .input('labor_count', laborCount)
      .input('base_price', basePrice)
      .input('distance_price', distance * pricePerKm)
      .input('weight_price', weightPrice)
      .input('labor_price', laborPrice)
      .input('total_price', estimatedPrice)
      .query(`
        INSERT INTO orders (
          user_id, pickup_address, pickup_latitude, pickup_longitude,
          destination_address, destination_latitude, destination_longitude,
          cargo_photo_url, customer_notes, distance_km,
          weight_kg, labor_count, base_price, distance_price,
          weight_price, labor_price, total_price, status, created_at
        )
        OUTPUT INSERTED.id, INSERTED.created_at
        VALUES (
          @user_id, @pickup_address, @pickup_latitude, @pickup_longitude,
          @destination_address, @destination_latitude, @destination_longitude,
          @cargo_photo_url, @customer_notes, @distance_km,
          @weight_kg, @labor_count, @base_price, @distance_price,
          @weight_price, @labor_price, @total_price, 'pending', GETDATE()
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
          weight: weightKg || 0,
          laborCount: laborCount || 0,
          estimatedPrice
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
        estimatedPrice,
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