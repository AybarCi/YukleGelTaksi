import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import ReviewOrderPhotos from '../components/ReviewOrderPhotos';
import { cancelOrder } from '../store/slices/orderSlice';
import socketService from '../services/socketService';

interface Order {
  id?: string;
  status?: string;
  pickupAddress?: string;
  destinationAddress?: string;
  pickup_address?: string;
  destination_address?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  destinationLatitude?: number;
  destinationLongitude?: number;
  pickup_latitude?: number;
  pickup_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
  distance?: number;
  distance_km?: number;
  estimatedPrice?: number;
  total_price?: number;
  notes?: string;
  customer_notes?: string;
  driver_notes?: string;
  driver_name?: string;
  driver_phone?: string;
  vehicleTypeId?: string | number;
  vehicle_type_id?: number;
  cargoImages?: string[];
  cargo_photo_urls?: string[];
  createdAt?: string;
  created_at?: string;
  estimated_arrival?: string;
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const vehicleTypes = useSelector((state: RootState) => state.vehicle.vehicleTypes);
  const { currentOrder } = useSelector((state: RootState) => state.order);

  useEffect(() => {
    console.log('OrderDetail Debug - currentOrder:', currentOrder);
    console.log('OrderDetail Debug - orderId:', orderId);
    console.log('OrderDetail Debug - vehicleTypes:', vehicleTypes);
    console.log('OrderDetail Debug - vehicleTypes length:', vehicleTypes?.length);
    
    // Eğer orderId'dan order ID geliyorsa, o siparişi bul
    // Şimdilik currentOrder'ı kullanıyoruz
    if (currentOrder) {
      console.log('OrderDetail - currentOrder bulundu, order state e set ediliyor');
      console.log('Vehicle Type Debug:', {
         vehicleTypeId: currentOrder.vehicleTypeId,
         vehicleTypes: vehicleTypes,
         vehicleTypesLength: vehicleTypes?.length
       });
      console.log('Cargo Photos Debug:', {
        cargoImages: currentOrder.cargoImages,
        cargoImages_type: typeof currentOrder.cargoImages,
        cargoImages_length: currentOrder.cargoImages?.length,
        combined: currentOrder.cargoImages || []
      });
      setOrder(currentOrder);
    } else {
      console.log('OrderDetail - currentOrder bulunamadı');
      setOrder(null);
    }
    setLoading(false);
  }, [currentOrder, orderId, vehicleTypes]);

  // Socket event listener for order status updates
  useEffect(() => {
    const handleOrderStatusUpdate = (data: any) => {
      console.log('📊 ORDER DETAIL: Sipariş durumu güncellendi:', data);
      
      // Eğer güncellenen sipariş bu sayfadaki siparişse, durumu güncelle
      if (order && data.orderId && data.orderId.toString() === order.id?.toString()) {
        console.log('📊 ORDER DETAIL: Sipariş durumu güncelleniyor:', data.status);
        setOrder(prevOrder => ({
          ...prevOrder!,
          status: data.status
        }));
      }
    };

    // Socket event listener'ını ekle
    socketService.on('order_status_update', handleOrderStatusUpdate);

    // Cleanup function
    return () => {
      socketService.off('order_status_update', handleOrderStatusUpdate);
    };
  }, [order]);

  const handleCancelOrder = () => {
    if (!order?.id) {
      Alert.alert('Hata', 'Sipariş bilgisi bulunamadı.');
      return;
    }

    Alert.alert(
      'Siparişi İptal Et',
      'Bu siparişi iptal etmek istediğinizden emin misiniz?',
      [
        {
          text: 'Vazgeç',
          style: 'cancel',
        },
        {
          text: 'İptal Et',
          style: 'destructive',
          onPress: () => {
            dispatch(cancelOrder({ 
              orderId: parseInt(order.id!), 
              reason: 'Müşteri tarafından iptal edildi' 
            }) as any);
          },
        },
      ]
    );
  };

  const canCancelOrder = (status?: string) => {
    if (!status) return false;
    // Sadece belirli durumlarda iptal edilebilir
    return ['pending', 'inspecting', 'accepted', 'confirmed', 'started'].includes(status);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Beklemede';
      case 'inspecting': return 'İnceleniyor';
      case 'accepted': return 'Kabul Edildi';
      case 'confirmed': return 'Onaylandı';
      case 'in_progress': return 'Sürücü Yolda';
      case 'started': return 'Yük Alındı';
      case 'transporting': return 'Taşıma Durumunda';
      case 'completed': return 'Tamamlandı';
      case 'cancelled': return 'İptal Edildi';
      default: return status || 'Bilinmiyor';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'inspecting': return '#3B82F6';
      case 'accepted':
      case 'confirmed': return '#10B981';
      case 'in_progress':
      case 'started':
      case 'transporting': return '#8B5CF6';
      case 'completed': return '#059669';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getVehicleTypeName = (vehicleTypeId?: number) => {
    if (!vehicleTypeId || !vehicleTypes.length) return 'Bilinmiyor';
    const vehicleType = vehicleTypes.find((type: { id: number; name: string }) => type.id === vehicleTypeId);
    return vehicleType?.name || 'Bilinmiyor';
  };

  const handleCallDriver = () => {
    if (order?.driver_phone) {
      Linking.openURL(`tel:${order.driver_phone}`);
    } else {
      Alert.alert('Uyarı', 'Sürücü telefon numarası bulunamadı.');
    }
  };

  const handleOpenMap = (latitude?: number, longitude?: number, label?: string) => {
    if (latitude && longitude) {
      const url = `https://maps.apple.com/?q=${latitude},${longitude}&ll=${latitude},${longitude}`;
      Linking.openURL(url);
    } else {
      Alert.alert('Uyarı', 'Konum bilgisi bulunamadı.');
    }
  };

  // Fotoğraf verilerini birleştiren yardımcı fonksiyon
  const getCargoImages = () => {
    let images: string[] = [];
    
    // Önce cargo_photo_urls'i kontrol et
    if (order?.cargo_photo_urls) {
      try {
        const photoUrls = typeof order.cargo_photo_urls === 'string' 
          ? JSON.parse(order.cargo_photo_urls) 
          : order.cargo_photo_urls;
        
        const urlArray = Array.isArray(photoUrls) ? photoUrls : photoUrls.split(',');
        images = [...images, ...urlArray.map((url: string) => url.trim())];
      } catch (error) {
        console.log('Fotoğraf parse hatası:', error);
      }
    }
    
    // cargoImages'i de ekle (eğer varsa)
    if (order?.cargoImages && order.cargoImages.length > 0) {
      images = [...images, ...order.cargoImages];
    }
    
    // Tekrar eden URL'leri kaldır
    return [...new Set(images)];
  };

  if (!order) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sipariş Detayı</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="error-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>Sipariş bilgisi bulunamadı</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sipariş Detayı</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Sipariş Durumu */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status || '') + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status || '') }]} />
              <Text style={[styles.statusText, { color: getStatusColor(order.status || '') }]}>
                {getStatusText(order.status || '')}
              </Text>
            </View>
            <Text style={styles.orderIdText}>#{order.id || 'N/A'}</Text>
          </View>
          
          {order.estimated_arrival && (
            <View style={styles.etaContainer}>
              <Ionicons name="time-outline" size={16} color="#6B7280" />
              <Text style={styles.etaText}>Tahmini Varış: {order.estimated_arrival} dakika</Text>
            </View>
          )}
        </View>

        {/* Sürücü Bilgileri */}
        {order.driver_name && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sürücü Bilgileri</Text>
            <View style={styles.driverCard}>
              <View style={styles.driverInfo}>
                <MaterialIcons name="person" size={24} color="#F59E0B" />
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>{order.driver_name}</Text>
                  <Text style={styles.vehicleType}>{getVehicleTypeName(order.vehicle_type_id)}</Text>
                </View>
              </View>
              {order.driver_phone && (
                <TouchableOpacity onPress={handleCallDriver} style={styles.callButton}>
                  <Ionicons name="call" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Adres Bilgileri */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Adres Bilgileri</Text>
          
          <TouchableOpacity 
            style={styles.addressCard}
            //onPress={() => handleOpenMap(order.pickup_latitude, order.pickup_longitude, 'Alış Noktası')}
          >
            <View style={styles.addressIcon}>
              <Ionicons name="location" size={20} color="#10B981" />
            </View>
            <View style={styles.addressInfo}>
              <Text style={styles.addressLabel}>Yükün Konumu</Text>
              <Text style={styles.addressText}>{order.pickup_address || order.pickupAddress || 'Adres bilgisi bulunamadı'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>

          <View style={styles.routeLine} />

          <TouchableOpacity 
            style={styles.addressCard}
            //onPress={() => handleOpenMap(order.destination_latitude, order.destination_longitude, 'Varış Noktası')}
          >
            <View style={styles.addressIcon}>
              <Ionicons name="navigate" size={20} color="#EF4444" />
            </View>
            <View style={styles.addressInfo}>
              <Text style={styles.addressLabel}>Varış Noktası</Text>
              <Text style={styles.addressText}>{order.destination_address || order.destinationAddress || 'Adres bilgisi bulunamadı'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Sipariş Bilgileri */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sipariş Bilgileri</Text>
          <View style={styles.infoCard}>
            {order.distance_km && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Mesafe:</Text>
                <Text style={styles.infoValue}>{order.distance_km.toFixed(1)} km</Text>
              </View>
            )}
            {order.total_price && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Toplam Tutar:</Text>
                <Text style={styles.infoValue}>{order.total_price} TL</Text>
              </View>
            )}
            {order.estimatedPrice && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tahmini Tutar:</Text>
                <Text style={styles.infoValue}>{order.estimatedPrice} TL</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Araç Tipi:</Text>
              <Text style={styles.infoValue}>{getVehicleTypeName(order.vehicle_type_id || (typeof order.vehicleTypeId === 'string' ? parseInt(order.vehicleTypeId) : order.vehicleTypeId))}</Text>
            </View>
            {order.created_at && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Sipariş Tarihi:</Text>
                <Text style={styles.infoValue}>
                  {new Date(order.created_at).toLocaleDateString('tr-TR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Yük Fotoğrafları */}
        <View style={styles.section}>
          <ReviewOrderPhotos
            cargoImages={getCargoImages()}
            isEditable={false}
            title="Yük Fotoğrafları"
            required={false}
          />
        </View>

        {/* Sürücü İnceleme Durumu */}
        {order.status === 'inspecting' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sürücü İncelemesi</Text>
            <View style={styles.inspectionCard}>
              <View style={styles.inspectionHeader}>
                <Ionicons name="eye" size={24} color="#3B82F6" />
                <Text style={styles.inspectionTitle}>Sipariş İnceleniyor</Text>
              </View>
              <Text style={styles.inspectionText}>
                Bir sürücü siparişinizi inceliyor. Lütfen bekleyiniz.
              </Text>
              <View style={styles.inspectionStatus}>
                <View style={styles.statusIndicator}>
                  <View style={styles.pulsingDot} />
                </View>
                <Text style={styles.statusText}>Aktif İnceleme</Text>
              </View>
            </View>
          </View>
        )}

        {/* Sürücü İnceleme Geçmişi */}
        {(order.status === 'pending' || order.status === 'accepted' || order.status === 'confirmed') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>İnceleme Durumu</Text>
            <View style={styles.inspectionHistoryCard}>
              <View style={styles.inspectionHistoryItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.inspectionHistoryText}>Sipariş sürücüler tarafından görülebilir</Text>
              </View>
              <View style={styles.inspectionHistoryItem}>
                <Ionicons name="time" size={20} color="#F59E0B" />
                <Text style={styles.inspectionHistoryText}>Sürücü incelemesi bekleniyor</Text>
              </View>
            </View>
          </View>
        )}

        {/* Açıklama */}
        {(order.notes || order.customer_notes) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Açıklama</Text>
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>{order.notes || order.customer_notes}</Text>
            </View>
          </View>
        )}

        {/* Müşteri Notları */}
        {order.customer_notes && order.notes !== order.customer_notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Müşteri Notları</Text>
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>{order.customer_notes}</Text>
            </View>
          </View>
        )}

        {/* Sipariş İptal Butonu */}
        {canCancelOrder(order.status) && (
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleCancelOrder}
            >
              <Ionicons name="close-circle" size={20} color="#FFFFFF" />
              <Text style={styles.cancelButtonText}>Siparişi İptal Et</Text>
            </TouchableOpacity>
          </View>
        )}

        {order.driver_notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sürücü Notları</Text>
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>{order.driver_notes}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverDetails: {
    marginLeft: 12,
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  vehicleType: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  callButton: {
    backgroundColor: '#10B981',
    borderRadius: 20,
    padding: 8,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressInfo: {
    flex: 1,
    marginLeft: 12,
  },
  addressLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  addressText: {
    fontSize: 14,
    color: '#111827',
    marginTop: 2,
    lineHeight: 20,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#D1D5DB',
    marginLeft: 36,
    marginVertical: 8,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  imageContainer: {
    marginTop: 8,
  },
  noteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noteText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    textAlign: 'left',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  noDataText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  cancelButton: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8    
  },
  inspectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  inspectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inspectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginLeft: 8,
  },
  inspectionText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  inspectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    marginRight: 8,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  inspectionHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inspectionHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inspectionHistoryText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
});