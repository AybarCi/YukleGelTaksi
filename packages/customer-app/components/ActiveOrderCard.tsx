import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { setCurrentOrder as setReduxCurrentOrder } from '../store/slices/orderSlice';
import socketService from '../services/socketService';
import { formatTurkishLira } from '../app/utils/currencyUtils';

// OrderData tipini import et
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
  vehicle_type_id?: string | number;
  laborRequired?: boolean;
  laborCount?: number;
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

interface Order {
  id?: string;
  status?: string;
  pickupAddress?: string;
  pickup_address?: string;
  destinationAddress?: string;
  destination_address?: string;
  pickupLatitude?: number;
  pickup_latitude?: number;
  pickupLongitude?: number;
  pickup_longitude?: number;
  destinationLatitude?: number;
  destination_latitude?: number;
  destinationLongitude?: number;
  destination_longitude?: number;
  vehicleTypeId?: string | number;
  vehicle_type_id?: string | number;
  createdAt?: string;
  estimatedPrice?: number;
  distance?: number;
  estimatedTime?: number;
  notes?: string;
  laborRequired?: boolean;
  laborCount?: number;
  weight_kg?: number;
  cargoImages?: string[];
  driver_id?: string;
  driver_name?: string;
  driver_latitude?: number;
  driver_longitude?: number;
  driver_heading?: number;
}

interface ActiveOrderCardProps {
  order: Order;
  vehicleTypes?: any[];
}

const ActiveOrderCard: React.FC<ActiveOrderCardProps> = ({ 
  order, 
  vehicleTypes = []
}) => {
  // Redux store'dan currentOrder'ı al ve dispatch hook'unu kullan
  const currentOrder = useSelector((state: RootState) => state.order.currentOrder);
  const dispatch = useDispatch();
  
  // Güncel order'ı kullan (Redux store'dan gelen currentOrder öncelikli)
  const activeOrder = currentOrder || order;

  // Null/undefined order kontrolü
  if (!activeOrder) {
    return null;
  }

  // Animasyonlu progress bar için
  const progressAnimation = useRef(new Animated.Value(0)).current;

  // Socket event listener'ı ekle
  useEffect(() => {
    const handleOrderStatusUpdate = (data: any) => {
      // Eğer güncellenen sipariş bu componentteki siparişse, durumu güncelle
      if (activeOrder && data.orderId && data.orderId.toString() === activeOrder.id?.toString()) {
        
        const updatedOrder: OrderData = {
          id: activeOrder.id || '',
          pickupAddress: activeOrder.pickupAddress || '',
          pickupLatitude: activeOrder.pickupLatitude || 0,
          pickupLongitude: activeOrder.pickupLongitude || 0,
          destinationAddress: activeOrder.destinationAddress || '',
          destinationLatitude: activeOrder.destinationLatitude || 0,
          destinationLongitude: activeOrder.destinationLongitude || 0,
          distance: activeOrder.distance || 0,
          estimatedTime: activeOrder.estimatedTime || 0,
          notes: activeOrder.notes || '',
          vehicleTypeId: activeOrder.vehicleTypeId || '',
          laborRequired: activeOrder.laborRequired || false,
          laborCount: activeOrder.laborCount || 0,
          weight_kg: activeOrder.weight_kg || 0,
          cargoImages: activeOrder.cargoImages || [],
          status: data.status, // Gelen status'u kullan
          estimatedPrice: activeOrder.estimatedPrice || 0,
          createdAt: activeOrder.createdAt || '',
          driver_id: activeOrder.driver_id,
          driver_name: activeOrder.driver_name,
          driver_latitude: activeOrder.driver_latitude,
          driver_longitude: activeOrder.driver_longitude,
          driver_heading: activeOrder.driver_heading,
        };
        
        // Redux store'u güncelle
        dispatch(setReduxCurrentOrder(updatedOrder));
        
        // Modal mantığı kaldırıldı
      }
    };

    // Socket event listener'ını ekle
    socketService.on('order_status_update', handleOrderStatusUpdate);

    // Cleanup function
    return () => {
      socketService.off('order_status_update', handleOrderStatusUpdate);
    };
  }, [activeOrder, dispatch]);

  // İnceleme durumu kontrolü kaldırıldı

  // Progress bar animasyonunu başlat
  useEffect(() => {
    const startAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnimation, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(progressAnimation, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    };

    startAnimation();
  }, [progressAnimation]);

  // Araç tipi adını bul
  const getVehicleTypeName = useCallback((vehicleTypeId?: string | number) => {
    if (!vehicleTypeId || !vehicleTypes || vehicleTypes.length === 0) {
      return 'Araç Tipi Belirtilmemiş';
    }
    
    let id: number;
    if (typeof vehicleTypeId === 'string') {
      id = parseInt(vehicleTypeId);
      if (isNaN(id)) {
        return 'Geçersiz Araç Tipi';
      }
    } else {
      id = vehicleTypeId;
    }
    
    const vehicleType = vehicleTypes.find(type => type.id === id);
    
    return vehicleType ? vehicleType.name : 'Bilinmeyen Araç Tipi';
  }, [vehicleTypes]);

  // Sipariş durumuna göre metin ve renk
  const getStatusText = (status?: string): string => {
    const statusMap: { [key: string]: string } = {
      'pending': 'Sipariş Bekliyor',
      'inspecting': 'İnceleniyor',
      'driver_accepted_awaiting_customer': 'Onayla',
      'accepted': 'Kabul Edildi',
      'customer_price_approved': 'Fiyat Onaylandı',
      'customer_price_rejected': 'Fiyat Reddedildi',
      'driver_going_to_pickup': 'Sürücü Yolda',
      'confirmed': 'Onaylandı',
      'in_progress': 'Devam Ediyor',
      'started': 'Başladı',
      'completed': 'Tamamlandı',
      'cancelled': 'İptal Edildi'
    };
    return statusMap[status || ''] || status || 'Bilinmeyen Durum';
  };

  const getStatusColor = (status?: string): string => {
    const colorMap: { [key: string]: string } = {
      'pending': '#FFA500',
      'inspecting': '#FF6B35',
      'driver_accepted_awaiting_customer': '#FF6B35',
      'accepted': '#4CAF50',
      'customer_price_approved': '#4CAF50',
      'customer_price_rejected': '#F44336',
      'driver_going_to_pickup': '#2196F3',
      'confirmed': '#2196F3',
      'in_progress': '#9C27B0',
      'started': '#FF9800',
      'completed': '#4CAF50',
      'cancelled': '#F44336'
    };
    return colorMap[status || ''] || '#666';
  };

  const vehicleTypeName = useMemo(() => {
    return getVehicleTypeName(activeOrder?.vehicleTypeId || activeOrder?.vehicle_type_id);
  }, [getVehicleTypeName, activeOrder?.vehicleTypeId, activeOrder?.vehicle_type_id]);
  
  const statusText = getStatusText(activeOrder?.status);
  const statusColor = getStatusColor(activeOrder?.status);

  const handlePress = () => {
    router.push('/order-detail');
  };

  // Modal kapatma fonksiyonu kaldırıldı

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color="#6B7280" />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.orderInfo}>
            <MaterialIcons name="local-shipping" size={24} color="#F59E0B" />
            <View style={styles.orderDetails}>
              <Text style={styles.orderTitle}>Aktif Siparişiniz</Text>
              <View style={styles.addressContainer}>
                <View style={styles.addressRow}>
                   <Ionicons name="location-outline" size={16} color="#666" />
                   <Text style={styles.addressText} numberOfLines={2}>
                     {activeOrder?.pickupAddress || 'Yükleme adresi belirtilmemiş'}
                   </Text>
                 </View>
                 <View style={styles.addressRow}>
                   <Ionicons name="flag-outline" size={16} color="#666" />
                   <Text style={styles.addressText} numberOfLines={2}>
                     {activeOrder?.destinationAddress || 'Varış adresi belirtilmemiş'}
                   </Text>
                 </View>
              </View>
              <View style={styles.orderMeta}>
                <Text style={styles.orderMetaText}>
                  Sipariş #{activeOrder?.id || 'N/A'}
                </Text>
                {vehicleTypeName && (
                  <Text style={styles.orderMetaText}>
                    • {vehicleTypeName}
                  </Text>
                )}
                {activeOrder?.estimatedPrice && typeof activeOrder?.estimatedPrice === 'number' && !isNaN(activeOrder?.estimatedPrice) && (
                  <Text style={styles.orderMetaText}>
                    • {formatTurkishLira(activeOrder?.estimatedPrice || 0)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Timeline Progress Indicator */}
        <View style={styles.timelineContainer}>
          <View style={styles.phaseStep}>
            <View style={[
              styles.phaseCircle,
              ['pending', 'inspecting'].includes(order?.status || '') ? styles.phaseActive :
              ['accepted', 'confirmed', 'in_progress', 'started', 'transporting', 'completed'].includes(order?.status || '') ? styles.phaseCompleted : styles.phaseInactive
            ]}>
              <MaterialIcons 
                name={(order?.status === 'inspecting') ? 'search' : 'schedule'} 
                size={12} 
                color={['pending', 'inspecting'].includes(order?.status || '') ? '#F59E0B' : 
                       ['accepted', 'confirmed', 'in_progress', 'started', 'transporting', 'completed'].includes(order?.status || '') ? '#FFFFFF' : '#9CA3AF'} 
              />
            </View>
            <Text style={styles.phaseLabel}>{(order?.status === 'inspecting') ? 'İnceleniyor' : 'Bekliyor'}</Text>
          </View>
          
          <View style={[
            styles.phaseLine,
            ['driver_accepted_awaiting_customer', 'accepted', 'confirmed', 'in_progress', 'started', 'transporting', 'completed'].includes(order?.status || '') ? styles.phaseLineCompleted : styles.phaseLineInactive
          ]} />
          
          <View style={styles.phaseStep}>
            <View style={[
              styles.phaseCircle,
              ['driver_accepted_awaiting_customer', 'accepted', 'confirmed'].includes(order?.status || '') ? styles.phaseActive :
              ['in_progress', 'started', 'transporting', 'completed'].includes(order?.status || '') ? styles.phaseCompleted : styles.phaseInactive
            ]}>
              <MaterialIcons 
                name="local-shipping" 
                size={12} 
                color={['driver_accepted_awaiting_customer', 'accepted', 'confirmed'].includes(order?.status || '') ? '#F59E0B' : 
                       ['in_progress', 'started', 'transporting', 'completed'].includes(order?.status || '') ? '#FFFFFF' : '#9CA3AF'} 
              />
            </View>
            <Text style={styles.phaseLabel}>
              {order?.status === 'driver_accepted_awaiting_customer' ? 'Onayla' : 'Yolda'}
            </Text>
          </View>
          
          <View style={[
            styles.phaseLine,
            ['accepted', 'confirmed', 'in_progress', 'started', 'transporting', 'completed'].includes(order?.status || '') ? styles.phaseLineCompleted : styles.phaseLineInactive
          ]} />
          
          <View style={styles.phaseStep}>
            <View style={[
              styles.phaseCircle,
              (order?.status === 'in_progress') ? styles.phaseActive :
              ['started', 'transporting', 'completed'].includes(order?.status || '') ? styles.phaseCompleted : styles.phaseInactive
            ]}>
              <MaterialIcons 
                name="inventory" 
                size={12} 
                color={(order?.status === 'in_progress') ? '#F59E0B' : 
                       ['started', 'transporting', 'completed'].includes(order?.status || '') ? '#FFFFFF' : '#9CA3AF'} 
              />
            </View>
            <Text style={styles.phaseLabel}>Alındı</Text>
          </View>
          
          <View style={[
            styles.phaseLine,
            ['transporting', 'completed'].includes(order?.status || '') ? styles.phaseLineCompleted : styles.phaseLineInactive
          ]} />
          
          <View style={styles.phaseStep}>
            <View style={[
              styles.phaseCircle,
              (order?.status === 'transporting') ? styles.phaseActive :
              (order?.status === 'completed') ? styles.phaseCompleted : styles.phaseInactive
            ]}>
              <MaterialIcons 
                name="check" 
                size={12} 
                color={(order?.status === 'transporting') ? '#F59E0B' : 
                       (order?.status === 'completed') ? '#FFFFFF' : '#9CA3AF'} 
              />
            </View>
            <Text style={styles.phaseLabel}>Teslim</Text>
          </View>
        </View>

        {/* Animasyonlu Progress Bar */}
        <View style={styles.animatedProgressContainer}>
          <View style={styles.animatedProgressTrack}>
            <Animated.View 
              style={[
                styles.animatedProgressFill,
                {
                  width: progressAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: statusColor,
                }
              ]} 
            />
          </View>
          <Text style={styles.animatedProgressText}>İşleminiz devam ediyor...</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Detayları görmek için dokunun
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 0,
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginHorizontal: 0,
    width: '100%',
    minHeight: 160,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  content: {
    marginBottom: 20,
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  orderDetails: {
    flex: 1,
    marginLeft: 16,
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  orderSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 10,
    lineHeight: 22,
  },
  orderMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  orderMetaText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginRight: 6,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  phaseStep: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  phaseCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  phaseActive: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  phaseCompleted: {
    backgroundColor: '#10B981',
  },
  phaseInactive: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  phaseLine: {
    height: 3,
    width: 24,
    marginHorizontal: 0,
  },
  phaseLineCompleted: {
    backgroundColor: '#10B981',
  },
  phaseLineInactive: {
    backgroundColor: '#E5E7EB',
  },
  phaseLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    flexWrap: 'wrap',
    maxWidth: 50,
  },
  animatedProgressContainer: {
    marginBottom: 16,
  },
  animatedProgressTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 10,
    overflow: 'hidden',
  },
  animatedProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  animatedProgressText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  addressContainer: {
    marginBottom: 10,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressText: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 10,
    flex: 1,
  },
});

export default ActiveOrderCard;