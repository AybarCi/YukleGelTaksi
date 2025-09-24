import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Image,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import ReviewOrderPhotos from '../components/ReviewOrderPhotos';
import { cancelOrder, calculateCancellationFee, clearCurrentOrder } from '../store/slices/orderSlice';
import socketService from '../services/socketService';
import PaymentModal from '../components/PaymentModal';
import CancelOrderModal from '../components/CancelOrderModal';
import SuccessModal from '../components/SuccessModal';
import { useAuth } from '../contexts/AuthContext';

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
  estimatedTime?: number;
  estimatedPrice?: number;
  total_price?: number;
  notes?: string;
  customer_notes?: string;
  driver_notes?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_id?: string;
  driver_latitude?: number;
  driver_longitude?: number;
  driver_heading?: number;
  vehicleTypeId?: string | number;
  vehicle_type_id?: string | number;
  laborRequired?: boolean;
  laborCount?: number;
  weight_kg?: number;
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
  const { showModal: authShowModal } = useAuth();
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [cancelOrderModalVisible, setCancelOrderModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalData, setSuccessModalData] = useState({ title: '', message: '' });
  const [cancellationFee, setCancellationFee] = useState(0);
  const [estimatedAmount, setEstimatedAmount] = useState(0);
  const [userCancelCode, setUserCancelCode] = useState('');
  const [confirmCodeInputs, setConfirmCodeInputs] = useState(['', '', '', '']);
  const confirmCodeInputRefs = React.useRef<(TextInput | null)[]>([]);
  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null);
  const [cancelConfirmCode, setCancelConfirmCode] = useState('');
  const vehicleTypes = useSelector((state: RootState) => state.vehicle.vehicleTypes);
  const { currentOrder } = useSelector((state: RootState) => state.order);

  // Debug: successModalVisible state değişimini takip et
  useEffect(() => {
    // Debug logs removed
  }, [successModalVisible, successModalData]);

  useEffect(() => {
    // Debug logs removed
    
    // Eğer orderId'dan order ID geliyorsa, o siparişi bul
    // Şimdilik currentOrder'ı kullanıyoruz
    if (currentOrder) {
      // Debug logs removed
      setOrder(currentOrder);
    } else {
      // Debug logs removed
      setOrder(null);
    }
    setLoading(false);
  }, [currentOrder, orderId, vehicleTypes]);

  // Socket event listener for order status updates
  useEffect(() => {
    // Debug logs removed
    
    const handleOrderStatusUpdate = (data: any) => {
      // Debug logs removed
      
      // Eğer güncellenen sipariş bu sayfadaki siparişse, durumu güncelle
      if (order && data.orderId && data.orderId.toString() === order.id?.toString()) {
        // Debug logs removed
        setOrder(prevOrder => ({
          ...prevOrder!,
          status: data.status
        }));
      }
    };

    const handleCancelOrderConfirmationRequired = (data: any) => {
      // Debug logs removed
      setCancelOrderId(data.orderId);
      setCancelConfirmCode(data.confirmCode);
      setCancellationFee(data.cancellationFee || 0);
      setCancelOrderModalVisible(true);
    };



    // Socket bağlantısını kontrol et
    if (!socketService.isSocketConnected()) {
      // Debug logs removed
      socketService.reconnect();
    }

    // Socket event listener'larını ekle
    // Debug logs removed
    socketService.on('order_status_update', handleOrderStatusUpdate);
    socketService.on('cancel_order_confirmation_required', handleCancelOrderConfirmationRequired);
    
    // Debug logs removed

    // Cleanup function
    return () => {
      // Debug logs removed
      socketService.off('order_status_update', handleOrderStatusUpdate);
      socketService.off('cancel_order_confirmation_required', handleCancelOrderConfirmationRequired);
    };
  }, [order, dispatch, router]);

  const handleCancelOrder = async () => {
    if (!order?.id) {
      authShowModal('Hata', 'Sipariş bilgisi bulunamadı.', 'error');
      return;
    }

    try {
      // Cezai şart hesaplama
      const result = await dispatch(calculateCancellationFee({ 
        orderId: parseInt(order.id) 
      }) as any).unwrap();
      
      if (result.success) {
        const fee = result.data.cancellationFee || 0;
        const estimated = result.data.estimatedAmount || order.estimatedPrice || order.total_price || 0;
        
        setCancellationFee(fee);
        setEstimatedAmount(estimated);
        
        // PaymentModal'ı göster (cezai şart var/yok durumuna göre)
        setPaymentModalVisible(true);
      } else {
        authShowModal('Hata', 'Cezai şart bilgisi alınamadı.', 'error');
      }
    } catch (error) {
      console.error('Cezai şart hesaplama hatası:', error);
      authShowModal('Hata', 'Cezai şart bilgisi alınamadı.', 'error');
    }
  };

  const handlePayment = () => {
    setPaymentModalVisible(false);
    // Ödeme sayfasına yönlendir
    router.push({
      pathname: '/payment',
      params: {
        orderId: order?.id,
        cancellationFee: cancellationFee.toString(),
        estimatedAmount: estimatedAmount.toString()
      }
    });
  };

  const handleDirectCancel = () => {
    setPaymentModalVisible(false);
    // Direkt modal açmak yerine önce backend'e cancel_order gönder
    if (order?.id) {
      // Debug logs removed
      socketService.cancelOrder(parseInt(order.id));
    } else {
      authShowModal('Hata', 'Sipariş bilgisi bulunamadı.', 'error');
    }
  };

  const handleCancelOrderModalClose = () => {
    setCancelOrderModalVisible(false);
    setUserCancelCode('');
    setConfirmCodeInputs(['', '', '', '']);
  };

  const showModal = (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info', onPress?: () => void) => {
    // Debug logs removed
    
    // İptal işlemi başarılı olduğunda anasayfaya yönlendir
    if (type === 'success' && title === 'İptal İşlemi Başarılı') {
      const handleSuccess = () => {
        // Debug logs removed
        router.push('/');
        if (onPress) onPress();
      };
      authShowModal(title, message, type, [{ text: 'Tamam', onPress: handleSuccess }]);
    } else {
      // Diğer durumlar için normal modal
      authShowModal(title, message, type, onPress ? [{ text: 'Tamam', onPress }] : undefined);
    }
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
      authShowModal('Uyarı', 'Sürücü telefon numarası bulunamadı.', 'warning');
    }
  };

  const handleOpenMap = (latitude?: number, longitude?: number, label?: string) => {
    if (latitude && longitude) {
      const url = `https://maps.apple.com/?q=${latitude},${longitude}&ll=${latitude},${longitude}`;
      Linking.openURL(url);
    } else {
      authShowModal('Uyarı', 'Konum bilgisi bulunamadı.', 'warning');
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
        // Error log removed
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
                  <Text style={styles.vehicleType}>{getVehicleTypeName(typeof order.vehicle_type_id === 'string' ? parseInt(order.vehicle_type_id) : order.vehicle_type_id)}</Text>
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
              <Text style={styles.infoValue}>{getVehicleTypeName(typeof order.vehicle_type_id === 'string' ? parseInt(order.vehicle_type_id) : order.vehicle_type_id || (typeof order.vehicleTypeId === 'string' ? parseInt(order.vehicleTypeId) : order.vehicleTypeId))}</Text>
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

      {/* PaymentModal */}
      <PaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        onPayment={handlePayment}
        onDirectCancel={handleDirectCancel}
        cancellationFee={cancellationFee}
        estimatedAmount={estimatedAmount}
        orderId={order?.id ? parseInt(order.id) : 0}
      />

      {/* CancelOrderModal */}
      <CancelOrderModal
        visible={cancelOrderModalVisible}
        onClose={handleCancelOrderModalClose}
        cancelOrderId={cancelOrderId}
        userCancelCode={userCancelCode}
        setUserCancelCode={setUserCancelCode}
        confirmCodeInputs={confirmCodeInputs}
        setConfirmCodeInputs={setConfirmCodeInputs}
        confirmCodeInputRefs={confirmCodeInputRefs}
        showModal={showModal}
      />

      {/* SuccessModal */}
      <SuccessModal
        visible={successModalVisible}
        onClose={() => {
          console.log('🔍 DEBUG: SuccessModal onClose çağrıldı');
          setSuccessModalVisible(false);
        }}
        title={successModalData.title || "İptal İşlemi Başarılı"}
        message={successModalData.message || "Siparişiniz başarılı bir şekilde iptal edilmiştir."}
        buttonText="Ana Sayfaya Dön"
        onButtonPress={() => {
          console.log('🔍 DEBUG: SuccessModal onButtonPress çağrıldı');
          setSuccessModalVisible(false);
          router.replace('/home');
        }}
      />

      {/* Debug: Modal visible durumunu göster */}
      {successModalVisible && (
        <View style={{
          position: 'absolute',
          top: 100,
          left: 20,
          backgroundColor: 'red',
          padding: 10,
          zIndex: 9999
        }}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>
            DEBUG: Modal visible = {successModalVisible.toString()}
          </Text>
        </View>
      )}

      <StatusBar style="dark" />
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