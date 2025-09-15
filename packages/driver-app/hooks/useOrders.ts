import { useState, useEffect, useCallback } from 'react';
import { API_CONFIG } from '../config/api';
import { OrderData } from '../types/dashboard';

interface UseOrdersReturn {
  activeOrder: OrderData | null;
  availableOrders: OrderData[];
  orderHistory: OrderData[];
  isLoading: boolean;
  error: string | null;
  acceptOrder: (orderId: number) => Promise<boolean>;
  rejectOrder: (orderId: number) => Promise<boolean>;
  completePickup: (orderId: number) => Promise<boolean>;
  completeDelivery: (orderId: number) => Promise<boolean>;
  fetchActiveOrder: () => Promise<void>;
  fetchAvailableOrders: () => Promise<void>;
  fetchOrderHistory: () => Promise<void>;
  refreshOrders: () => Promise<void>;
}

export const useOrders = (driverId: number, token: string): UseOrdersReturn => {
  const [activeOrder, setActiveOrder] = useState<OrderData | null>(null);
  const [availableOrders, setAvailableOrders] = useState<OrderData[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveOrder = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/${driverId}/active-order`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setActiveOrder(data.order || null);
      } else if (response.status === 404) {
        setActiveOrder(null);
      } else {
        throw new Error('Aktif sipariş alınamadı');
      }
    } catch (error) {
      console.error('Aktif sipariş alma hatası:', error);
      setError('Aktif sipariş bilgisi alınamadı');
    }
  }, [driverId, token]);

  const fetchAvailableOrders = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/available-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableOrders(data.orders || []);
      } else {
        throw new Error('Müsait siparişler alınamadı');
      }
    } catch (error) {
      console.error('Müsait siparişler alma hatası:', error);
      setError('Müsait siparişler alınamadı');
    }
  }, [token]);

  const fetchOrderHistory = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/${driverId}/order-history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrderHistory(data.orders || []);
      } else {
        throw new Error('Sipariş geçmişi alınamadı');
      }
    } catch (error) {
      console.error('Sipariş geçmişi alma hatası:', error);
      setError('Sipariş geçmişi alınamadı');
    }
  }, [driverId, token]);

  const acceptOrder = useCallback(async (orderId: number): Promise<boolean> => {
    try {
      setError(null);
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/${orderId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ driverId }),
      });

      if (response.ok) {
        await fetchActiveOrder();
        await fetchAvailableOrders();
        return true;
      } else {
        throw new Error('Sipariş kabul edilemedi');
      }
    } catch (error) {
      console.error('Sipariş kabul etme hatası:', error);
      setError('Sipariş kabul edilemedi');
      return false;
    }
  }, [driverId, token, fetchActiveOrder, fetchAvailableOrders]);

  const rejectOrder = useCallback(async (orderId: number): Promise<boolean> => {
    try {
      setError(null);
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/${orderId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ driverId }),
      });

      if (response.ok) {
        await fetchAvailableOrders();
        return true;
      } else {
        throw new Error('Sipariş reddedilemedi');
      }
    } catch (error) {
      console.error('Sipariş reddetme hatası:', error);
      setError('Sipariş reddedilemedi');
      return false;
    }
  }, [driverId, token, fetchAvailableOrders]);

  const completePickup = useCallback(async (orderId: number): Promise<boolean> => {
    try {
      setError(null);
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/${orderId}/pickup-complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ driverId }),
      });

      if (response.ok) {
        await fetchActiveOrder();
        return true;
      } else {
        throw new Error('Yük alma tamamlanamadı');
      }
    } catch (error) {
      console.error('Yük alma tamamlama hatası:', error);
      setError('Yük alma tamamlanamadı');
      return false;
    }
  }, [driverId, token, fetchActiveOrder]);

  const completeDelivery = useCallback(async (orderId: number): Promise<boolean> => {
    try {
      setError(null);
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/${orderId}/delivery-complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ driverId }),
      });

      if (response.ok) {
        await fetchActiveOrder();
        await fetchOrderHistory();
        return true;
      } else {
        throw new Error('Teslimat tamamlanamadı');
      }
    } catch (error) {
      console.error('Teslimat tamamlama hatası:', error);
      setError('Teslimat tamamlanamadı');
      return false;
    }
  }, [driverId, token, fetchActiveOrder, fetchOrderHistory]);

  const refreshOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchActiveOrder(),
        fetchAvailableOrders(),
        fetchOrderHistory(),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchActiveOrder, fetchAvailableOrders, fetchOrderHistory]);

  useEffect(() => {
    if (driverId && token) {
      refreshOrders();
    }
  }, [driverId, token, refreshOrders]);

  return {
    activeOrder,
    availableOrders,
    orderHistory,
    isLoading,
    error,
    acceptOrder,
    rejectOrder,
    completePickup,
    completeDelivery,
    fetchActiveOrder,
    fetchAvailableOrders,
    fetchOrderHistory,
    refreshOrders,
  };
};