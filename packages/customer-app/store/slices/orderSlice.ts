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
  vehicleTypeId?: string;
  laborRequired?: boolean;
  laborCount?: number;
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
}

const initialState: OrderState = {
  currentOrder: null,
  loading: false,
  error: null,
  createOrderLoading: false,
  checkOrderLoading: false,
  cancelOrderLoading: false,
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
      formData.append('vehicleTypeId', orderData.vehicleTypeId?.toString() || '');
      formData.append('laborRequired', 'true');
      formData.append('laborCount', '1');

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

        // Socket'e sipariş bilgisini gönder
        socketService.createOrder({
          pickupLatitude: orderData.pickupLatitude,
          pickupLongitude: orderData.pickupLongitude,
          destinationLatitude: orderData.destinationLatitude,
          destinationLongitude: orderData.destinationLongitude,
          pickupAddress: orderData.pickupAddress,
          destinationAddress: orderData.destinationAddress,
          weight: 1, // Default weight
          laborCount: 1, // Default labor count
          estimatedPrice: result.order.estimatedPrice || 0,
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
        `${API_CONFIG.BASE_URL}/api/users/orders?status=pending,inspecting,accepted,confirmed,in_progress&limit=1`,
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
        state.currentOrder = action.payload;
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
      });
  },
});

export const {
  setCurrentOrder,
  clearCurrentOrder,
  updateOrderStatus,
  setDriverInfo,
  clearError,
} = orderSlice.actions;

export default orderSlice.reducer;