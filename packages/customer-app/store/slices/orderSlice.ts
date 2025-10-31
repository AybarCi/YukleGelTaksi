import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../../config/api';
import socketService from '../../services/socketService';

interface OrderData {
  id?: string;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  distance: number;
  estimatedTime: number;
  notes?: string;
  vehicleTypeId?: string | number;
  vehicle_type_id?: string | number; // Socket service için alternatif alan
  cargoTypeId?: string | number;
  cargo_type_id?: string | number;
  laborRequired?: boolean;
  laborCount?: number;
  base_labor_count?: number;
  weight_kg?: number;
  cargoImages: string[];
  status?: string;
  estimatedPrice?: number;
  createdAt?: string;
  driver_id?: string;
  driver_name?: string;
  driver_latitude?: number;
  driver_longitude?: number;
  driver_heading?: number;
}

interface OrderState {
  currentOrder: OrderData | null;
  loading: boolean;
  error: string | null;
  createOrderLoading: boolean;
  checkOrderLoading: boolean;
  cancelOrderLoading: boolean;
  isNewOrderCreated: boolean; // Yeni sipariş oluşturulduğunu belirten flag
}

const initialState: OrderState = {
  currentOrder: null,
  loading: false,
  error: null,
  createOrderLoading: false,
  checkOrderLoading: false,
  cancelOrderLoading: false,
  isNewOrderCreated: false,
};

// Sipariş oluşturma async thunk
export const createOrder = createAsyncThunk(
  'order/createOrder',
  async (
    {
      orderData,
      token,
      refreshAuthToken,
    }: {
      orderData: OrderData;
      token: string;
      refreshAuthToken: () => Promise<boolean>;
    },
    { rejectWithValue }
  ) => {
    try {
      // FormData oluştur
      const formData = new FormData();
      formData.append('pickupAddress', orderData.pickupAddress);
      formData.append('pickupLatitude', orderData.pickupLatitude.toString());
      formData.append('pickupLongitude', orderData.pickupLongitude.toString());
      formData.append('destinationAddress', orderData.destinationAddress);
      formData.append('destinationLatitude', orderData.destinationLatitude.toString());
      formData.append('destinationLongitude', orderData.destinationLongitude.toString());
      formData.append('distance', orderData.distance.toString());
      formData.append('estimatedTime', orderData.estimatedTime.toString());
      formData.append('notes', orderData.notes || '');
      formData.append('vehicle_type_id', orderData.vehicleTypeId?.toString() || '');
      formData.append('cargo_type_id', orderData.cargoTypeId?.toString() || orderData.cargo_type_id?.toString() || '');
      formData.append('laborRequired', 'true');
      formData.append('laborCount', '1');
      formData.append('weight_kg', orderData.weight_kg?.toString() || '0');

      // Cargo images'ları FormData'ya ekle
      if (orderData.cargoImages.length > 0) {
        for (let i = 0; i < orderData.cargoImages.length; i++) {
          const fileExtension = orderData.cargoImages[i].split('.').pop() || 'jpg';
          formData.append(`cargoPhoto${i}`, {
            uri: orderData.cargoImages[i],
            type: `image/${fileExtension}`,
            name: `cargo${i}.${fileExtension}`,
          } as any);
        }
      }

      // API'ye sipariş gönder
      let response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      // Token süresi dolmuşsa yenile ve tekrar dene
      if (response.status === 401) {
        const refreshSuccess = await refreshAuthToken();
        if (refreshSuccess) {
          response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/create`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });
        } else {
          throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
        }
      }

      const result = await response.json();

      if (result.success) {
        // Sipariş bilgilerini AsyncStorage'a kaydet
        const orderInfo = {
          orderId: result.order.id,
          status: 'pending',
          pickupAddress: orderData.pickupAddress,
          destinationAddress: orderData.destinationAddress,
          distance: orderData.distance,
          estimatedPrice: result.order.estimatedPrice,
          createdAt: new Date().toISOString(),
          cargoImages: JSON.stringify(orderData.cargoImages),
          notes: orderData.notes,
        };

        await AsyncStorage.setItem('currentOrder', JSON.stringify(orderInfo));

        // Socket'e sipariş bilgisini gönder (sipariş ID'si ile birlikte)
        socketService.createOrder({
          orderId: result.order.id, // API'den dönen sipariş ID'si
          pickupLatitude: orderData.pickupLatitude,
          pickupLongitude: orderData.pickupLongitude,
          destinationLatitude: orderData.destinationLatitude,
          destinationLongitude: orderData.destinationLongitude,
          pickupAddress: orderData.pickupAddress,
          destinationAddress: orderData.destinationAddress,
          weight: 1, // Default weight
          laborCount: 1, // Default labor count
          estimatedPrice: result.order.estimatedPrice || 0,
          vehicle_type_id: Number(orderData.vehicleTypeId || orderData.vehicle_type_id) || undefined, // Araç tipi ID'si
          cargo_type_id: Number(orderData.cargoTypeId || orderData.cargo_type_id) || undefined, // Kargo tipi ID'si
        });

        return result.order;
      } else {
        throw new Error(result.error || 'Sipariş oluşturulurken bir hata oluştu.');
      }
    } catch (error) {
      console.error('Sipariş oluşturma hatası:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : 'Sipariş oluşturulurken bir hata oluştu.'
      );
    }
  }
);

// Mevcut siparişi kontrol etme async thunk
export const checkExistingOrder = createAsyncThunk(
  'order/checkExistingOrder',
  async ({ token }: { token: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/users/orders?status=pending,inspecting,accepted,customer_price_approved,customer_price_rejected,driver_going_to_pickup,confirmed,in_progress&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.orders && result.data.orders.length > 0) {
          const activeOrder = result.data.orders[0];
          return activeOrder;
        }
      } else {
        throw new Error('Sipariş kontrolü yapılamadı');
      }

      return null;
    } catch (error) {
      console.error('Sipariş kontrol hatası:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : 'Sipariş kontrolü yapılamadı'
      );
    }
  }
);

// Aktif siparişleri getirme async thunk
export const fetchActiveOrders = createAsyncThunk(
  'order/fetchActiveOrders',
  async (_, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token bulunamadı');
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/users/orders?status=pending,inspecting,accepted,driver_accepted_awaiting_customer,customer_price_approved,customer_price_rejected,driver_going_to_pickup,confirmed,in_progress,started&limit=1`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Aktif siparişler getirilemedi');
      }

      return data.data?.orders || [];
    } catch (error) {
      console.error('Aktif siparişler getirme hatası:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : 'Aktif siparişler getirilemedi'
      );
    }
  }
);

// İptal ücreti getirme async thunk
export const fetchCancellationFee = createAsyncThunk(
  'order/fetchCancellationFee',
  async (_, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token bulunamadı');
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/users/orders?status=cancelled&limit=1`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'İptal ücreti getirilemedi');
      }

      return data;
    } catch (error) {
      console.error('İptal ücreti getirme hatası:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : 'İptal ücreti getirilemedi'
      );
    }
  }
);

// Sipariş iptal etme async thunk
// Sipariş iptal ücreti hesaplama
export const calculateCancellationFee = createAsyncThunk(
  'order/calculateCancellationFee',
  async ({ orderId }: { orderId: number }, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token bulunamadı');
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/${orderId}/cancellation-fee`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'İptal ücreti hesaplanamadı');
      }

      return data;
    } catch (error) {
      console.error('İptal ücreti hesaplama hatası:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : 'İptal ücreti hesaplanamadı'
      );
    }
  }
);

// Cancel order with code async thunk
export const cancelOrderWithCode = createAsyncThunk(
  'order/cancelOrderWithCode',
  async (
    { orderId, confirmCode }: { orderId: number; confirmCode: string },
    { rejectWithValue }
  ) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/${orderId}/cancel-with-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmCode }),
      });

      const result = await response.json();

      if (result.success) {
        // AsyncStorage'dan mevcut siparişi temizle
        await AsyncStorage.removeItem('currentOrder');
        return result;
      } else {
        throw new Error(result.message || 'Sipariş iptal edilirken bir hata oluştu.');
      }
    } catch (error) {
      console.error('Sipariş iptal hatası:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : 'Sipariş iptal edilirken bir hata oluştu.'
      );
    }
  }
);

export const cancelOrder = createAsyncThunk(
  'order/cancelOrder',
  async (
    { orderId, reason }: { orderId: number; reason?: string },
    { rejectWithValue }
  ) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token bulunamadı');
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Sipariş iptal edilemedi');
      }

      // Socket üzerinden iptal isteği gönder
      socketService.cancelOrder(orderId);
      
      // AsyncStorage'dan siparişi temizle
      await AsyncStorage.removeItem('currentOrder');
      
      return { orderId, cancelled: true, ...data };
    } catch (error) {
      console.error('Sipariş iptal hatası:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : 'Sipariş iptal edilemedi'
      );
    }
  }
);

const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    setCurrentOrder: (state, action: PayloadAction<OrderData | null>) => {
      state.currentOrder = action.payload;
    },
    clearCurrentOrder: (state) => {
      state.currentOrder = null;
    },
    updateOrderStatus: (state, action: PayloadAction<{ status: string; data?: any }>) => {
      if (state.currentOrder) {
        state.currentOrder.status = action.payload.status;
        if (action.payload.data) {
          Object.assign(state.currentOrder, action.payload.data);
        }
      }
    },
    setDriverInfo: (
      state,
      action: PayloadAction<{
        driver_id: string;
        driver_name?: string;
        driver_latitude?: number;
        driver_longitude?: number;
        driver_heading?: number;
      }>
    ) => {
      if (state.currentOrder) {
        Object.assign(state.currentOrder, action.payload);
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    setNewOrderCreated: (state, action: PayloadAction<boolean>) => {
      state.isNewOrderCreated = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Create Order
      .addCase(createOrder.pending, (state) => {
        state.createOrderLoading = true;
        state.error = null;
      })
      .addCase(createOrder.fulfilled, (state, action) => {
        state.createOrderLoading = false;
        state.currentOrder = action.payload;
        state.error = null;
        state.isNewOrderCreated = true; // Yeni sipariş oluşturuldu flag'ini set et
        console.log('🎯 Redux: isNewOrderCreated set to TRUE', { 
          currentOrder: action.payload,
          isNewOrderCreated: state.isNewOrderCreated 
        });
      })
      .addCase(createOrder.rejected, (state, action) => {
        state.createOrderLoading = false;
        state.error = action.payload as string;
      })
      // Check Existing Order
      .addCase(checkExistingOrder.pending, (state) => {
        state.checkOrderLoading = true;
        state.error = null;
      })
      .addCase(checkExistingOrder.fulfilled, (state, action) => {
        state.checkOrderLoading = false;
        if (action.payload) {
          // API formatını Redux formatına çevir - vehicle_type_id'yi vehicleTypeId'ye dönüştür
          const apiOrder = action.payload;
          const reduxOrder: OrderData = {
            id: apiOrder.id ? apiOrder.id.toString() : `temp_${Date.now()}`,
            pickupAddress: apiOrder.pickup_address || '',
            pickupLatitude: apiOrder.pickup_latitude || 0,
            pickupLongitude: apiOrder.pickup_longitude || 0,
            destinationAddress: apiOrder.destination_address || '',
            destinationLatitude: apiOrder.destination_latitude || 0,
            destinationLongitude: apiOrder.destination_longitude || 0,
            distance: apiOrder.distance_km || 0,
            estimatedTime: 0,
            notes: apiOrder.customer_notes || '',
            vehicleTypeId: apiOrder.vehicle_type_id ? apiOrder.vehicle_type_id.toString() : '1',
            laborRequired: (apiOrder.labor_count || 0) > 0,
            laborCount: apiOrder.labor_count || 0,
            weight_kg: apiOrder.weight_kg || 0,
            cargoImages: apiOrder.cargo_photo_urls ? 
              (typeof apiOrder.cargo_photo_urls === 'string' ? JSON.parse(apiOrder.cargo_photo_urls) : apiOrder.cargo_photo_urls) 
              : [],
            status: apiOrder.status || 'pending',
            estimatedPrice: apiOrder.total_price || 0,
            createdAt: apiOrder.created_at,
            driver_id: apiOrder.driver?.id ? apiOrder.driver.id.toString() : undefined,
            driver_name: apiOrder.driver?.name || undefined,
            driver_latitude: apiOrder.driver?.latitude || undefined,
            driver_longitude: apiOrder.driver?.longitude || undefined,
            driver_heading: apiOrder.driver?.heading || undefined,
          };
          state.currentOrder = reduxOrder;
        } else {
          state.currentOrder = null;
        }
        state.error = null;
      })
      .addCase(checkExistingOrder.rejected, (state, action) => {
        state.checkOrderLoading = false;
        state.error = action.payload as string;
      })
      // Cancel Order
      .addCase(cancelOrder.pending, (state) => {
        state.cancelOrderLoading = true;
        state.error = null;
      })
      .addCase(cancelOrder.fulfilled, (state) => {
        state.cancelOrderLoading = false;
        state.currentOrder = null;
        state.error = null;
      })
      .addCase(cancelOrder.rejected, (state, action) => {
        state.cancelOrderLoading = false;
        state.error = action.payload as string;
      })
      // Cancel Order With Code
      .addCase(cancelOrderWithCode.pending, (state) => {
        state.cancelOrderLoading = true;
        state.error = null;
      })
      .addCase(cancelOrderWithCode.fulfilled, (state) => {
        state.cancelOrderLoading = false;
        state.currentOrder = null;
        state.error = null;
      })
      .addCase(cancelOrderWithCode.rejected, (state, action) => {
        state.cancelOrderLoading = false;
        state.error = action.payload as string;
      })
      // Fetch Active Orders
      .addCase(fetchActiveOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActiveOrders.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload && action.payload.length > 0) {
          const apiOrder = action.payload[0];
          
          // API formatını Redux formatına çevir - Güvenlik kontrolleri ile
          const reduxOrder: OrderData = {
            id: apiOrder.id ? apiOrder.id.toString() : `temp_${Date.now()}`,
            pickupAddress: apiOrder.pickup_address || '',
            pickupLatitude: apiOrder.pickup_latitude || 0,
            pickupLongitude: apiOrder.pickup_longitude || 0,
            destinationAddress: apiOrder.destination_address || '',
            destinationLatitude: apiOrder.destination_latitude || 0,
            destinationLongitude: apiOrder.destination_longitude || 0,
            distance: apiOrder.distance_km || 0,
            estimatedTime: 0,
            notes: apiOrder.customer_notes || '',
            vehicleTypeId: apiOrder.vehicle_type_id ? apiOrder.vehicle_type_id.toString() : '1',
            laborRequired: (apiOrder.labor_count || 0) > 0,
            laborCount: apiOrder.labor_count || 0,
            weight_kg: apiOrder.weight_kg || 0,
            cargoImages: apiOrder.cargo_photo_urls ? 
              (typeof apiOrder.cargo_photo_urls === 'string' ? JSON.parse(apiOrder.cargo_photo_urls) : apiOrder.cargo_photo_urls) 
              : [],
            status: apiOrder.status || 'pending',
            estimatedPrice: apiOrder.total_price || 0,
            createdAt: apiOrder.created_at,
            driver_id: apiOrder.driver?.id ? apiOrder.driver.id.toString() : undefined,
            driver_name: apiOrder.driver?.name || undefined,
            driver_latitude: apiOrder.driver?.latitude || undefined,
            driver_longitude: apiOrder.driver?.longitude || undefined,
            driver_heading: apiOrder.driver?.heading || undefined,
          };
          
          state.currentOrder = reduxOrder;
        } else {
          state.currentOrder = null;
        }
        state.error = null;
      })
      .addCase(fetchActiveOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Cancellation Fee
      .addCase(fetchCancellationFee.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCancellationFee.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchCancellationFee.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setCurrentOrder,
  clearCurrentOrder,
  updateOrderStatus,
  setDriverInfo,
  clearError,
  setNewOrderCreated,
} = orderSlice.actions;

export default orderSlice.reducer;