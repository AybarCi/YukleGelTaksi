import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { API_CONFIG } from '../config/api';
import socketService from '../services/socketService';

const { width, height } = Dimensions.get('window');

interface Customer {
  id: number;
  name: string;
  phone: string;
  pickup_location: string;
  destination: string;
  distance: string;
  estimated_fare: number;
  status: 'waiting' | 'accepted' | 'confirmed' | 'in_progress' | 'completed';
  created_at: string;
}

interface DriverInfo {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  is_active: boolean;
}

interface OrderData {
  id: number;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  weight: number;
  laborCount: number;
  estimatedPrice: number;
  customerId: number;
  customerName?: string;
  customerPhone?: string;
  distance?: number;
  estimatedArrival?: number;
}

export default function DriverDashboardScreen() {
  const { showModal, logout, token } = useAuth();
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [menuVisible, setMenuVisible] = useState(false);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    loadDriverInfo();
    loadCustomers();
    requestLocationPermission();
    
    // Socket bağlantısını kur - sadece sürücü çevrimiçiyse
    if (token) {
      // AsyncStorage'dan son online durumunu kontrol et
      AsyncStorage.getItem('driver_online_status').then(savedStatus => {
        const shouldBeOnline = savedStatus === 'true';
        setIsOnline(shouldBeOnline); // Online durumunu hemen set et
        if (shouldBeOnline) {
          socketService.connect(token);
        }
      });
      
      // Socket bağlantı durumu event'lerini dinle
      socketService.on('connection_error', (data: any) => {
        console.error('Socket bağlantı hatası:', data.error);
        showModal('Bağlantı Hatası', 'Sunucuya bağlanırken bir hata oluştu. Lütfen internet bağlantınızı kontrol edin.', 'error');
      });

      socketService.on('max_reconnect_attempts_reached', () => {
        console.log('Maksimum yeniden bağlanma denemesi aşıldı');
        showModal('Bağlantı Sorunu', 'Sunucuya bağlanılamıyor. Lütfen uygulamayı yeniden başlatın.', 'warning');
      });
      
      // Socket event listener'ları
      socketService.on('new_order', (orderData: OrderData) => {
        console.log('New order received:', orderData);
        
        // OrderData'yı Customer formatına dönüştür
        const newCustomer: Customer = {
          id: orderData.id,
          name: orderData.customerName || 'Müşteri',
          phone: orderData.customerPhone || 'Bilinmiyor',
          pickup_location: orderData.pickupAddress,
          destination: orderData.destinationAddress,
          distance: orderData.distance ? `${orderData.distance.toFixed(1)} km` : 'Hesaplanıyor...',
          estimated_fare: orderData.estimatedPrice,
          status: 'waiting',
          created_at: new Date().toISOString(),
        };
        
        // Yeni siparişi customers listesine ekle
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          // Aynı ID'li sipariş varsa güncelle, yoksa ekle
          const existingIndex = currentCustomers.findIndex(c => c.id === newCustomer.id);
          if (existingIndex >= 0) {
            const updated = [...currentCustomers];
            updated[existingIndex] = newCustomer;
            return updated;
          } else {
            return [newCustomer, ...currentCustomers];
          }
        });
      });
      
      socketService.on('order_cancelled', (orderId: number) => {
        console.log('Order cancelled:', orderId);
        // İptal edilen siparişi listeden kaldır
        setCustomers(prev => (prev || []).filter(customer => customer.id !== orderId));
      });
      
      // Müşteri siparişi onayladığında
      socketService.on('order_confirmed_by_customer', (data: { orderId: number, customerInfo: any }) => {
        console.log('Müşteri siparişi onayladı:', data);
        // Siparişi listeden kaldır ve başarı mesajı göster
        setCustomers(prev => (prev || []).filter(customer => customer.id !== data.orderId));
        // TODO: Başarı mesajı modal'ı göster
      });
      
      // Müşteri siparişi reddetti
      socketService.on('order_rejected_by_customer', (data: { orderId: number, reason?: string }) => {
        console.log('Müşteri siparişi reddetti:', data);
        // Siparişi listeden kaldır
        setCustomers(prev => (prev || []).filter(customer => customer.id !== data.orderId));
        // TODO: Bilgilendirme mesajı göster
      });
      
      // Server konum güncellemesi istediğinde mevcut konumu gönder
      socketService.on('request_location_update', async () => {
        console.log('Server konum güncellemesi istiyor, mevcut konum gönderiliyor...');
        if (currentLocation) {
          socketService.updateLocation({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            heading: 0
          });
          console.log('Mevcut konum sunucuya gönderildi:', currentLocation);
        } else {
          console.log('Konum bilgisi yok, konum alınmaya çalışılıyor...');
          // Konum bilgisi yoksa yeniden al
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            const newLocation = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            };
            setCurrentLocation(newLocation);
            socketService.updateLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              heading: location.coords.heading || 0,
            });
            console.log('Yeni konum alındı ve sunucuya gönderildi:', newLocation);
          } catch (error) {
            console.error('Konum alınırken hata:', error);
          }
        }
      });
      
      // Sipariş durumu güncellemelerini dinle
      socketService.on('order_status_update', (data: { orderId: number, status: string }) => {
        console.log('Sipariş durumu güncellendi:', data);
        
        // İlgili siparişi customers listesinde güncelle
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          return currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              return { ...customer, status: data.status as Customer['status'] };
            }
            return customer;
          });
        });
        
        // Sipariş tamamlandıysa listeden kaldır
        if (data.status === 'completed' || data.status === 'cancelled') {
          setCustomers(prev => (prev || []).filter(customer => customer.id !== data.orderId));
        }
      });
    }
    
    return () => {
      // Cleanup socket listeners
      socketService.off('connection_error');
      socketService.off('max_reconnect_attempts_reached');
      socketService.off('new_order');
      socketService.off('order_cancelled');
      socketService.off('request_location_update');
      // Cleanup location watch
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
      }
    };
  }, [token]);

  const loadDriverInfo = async () => {
    try {
      // Önce AsyncStorage'dan kaydedilmiş sürücü bilgilerini oku
      const savedDriverInfo = await AsyncStorage.getItem('driver_info');
      if (savedDriverInfo) {
        const driverData = JSON.parse(savedDriverInfo);
        console.log('AsyncStorage\'dan sürücü bilgileri yüklendi:', driverData);
        setDriverInfo(driverData);
      }

      // Online durumunu AsyncStorage'dan oku
      const savedOnlineStatus = await AsyncStorage.getItem('driver_online_status');
      const shouldBeOnline = savedOnlineStatus === 'true';
      setIsOnline(shouldBeOnline);

      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/phone-auth');
        return;
      }

      console.log('API çağrısı yapılıyor:', `${API_CONFIG.BASE_URL}/api/drivers/status`);
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('API yanıt durumu:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('API yanıtı:', result);
        
        if (result.success && result.data) {
          console.log('Sürücü bilgileri set ediliyor:', result.data);
          setDriverInfo(result.data);
          // Sürücü bilgilerini AsyncStorage'a kaydet
          await AsyncStorage.setItem('driver_info', JSON.stringify(result.data));
        } else {
          console.log('API yanıtında veri yok:', result);
        }
      } else {
        console.log('API yanıt hatası:', response.status, response.statusText);
        const errorText = await response.text();
        console.log('Hata detayı:', errorText);
      }
    } catch (error) {
      console.log('Error loading driver info:', error);
      // Network error durumunda AsyncStorage'dan yüklenen bilgileri kullan
      // Sadece hiç bilgi yoksa logout yap
      if (!driverInfo) {
        await logout();
        router.replace('/phone-auth');
      }
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showModal('Konum İzni', 'Konum izni gerekli. Lütfen ayarlardan konum iznini açın.', 'warning');
        return;
      }
      
      // Konum izni alındıktan sonra konum takibini başlat
      startLocationTracking();
    } catch (error) {
      console.error('Location permission error:', error);
      showModal('Hata', 'Konum izni alınırken hata oluştu.', 'error');
    }
  };

  const startLocationTracking = async () => {
    try {
      // İlk konumu al
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      
      setCurrentLocation(newLocation);
      
      // Socket ile konum gönder
      if (socketService.isSocketConnected()) {
        socketService.updateLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading || 0,
        });
      }
      
      // Konum takibini başlat (her 10 saniyede bir güncelle)
      locationWatchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // 10 saniye
          distanceInterval: 10, // 10 metre
        },
        (location) => {
          const newLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          
          setCurrentLocation(newLocation);
          
          // Socket ile konum gönder
          if (socketService.isSocketConnected() && isOnline) {
            socketService.updateLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              heading: location.coords.heading || 0,
            });
          }
        }
      );
    } catch (error) {
      console.error('Location tracking error:', error);
      showModal('Hata', 'Konum takibi başlatılırken hata oluştu.', 'error');
    }
  };

  const loadCustomers = async () => {
    try {
      // Gerçek sipariş verileri socket'ten gelecek
      // Bu fonksiyon artık sadece mevcut siparişleri temizlemek için kullanılıyor
      // Yeni siparişler 'new_order' socket event'i ile gelecek
      console.log('Mevcut sipariş listesi temizlendi, yeni siparişler socket üzerinden gelecek');
    } catch (error) {
      console.error('Sipariş listesi yüklenirken hata:', error);
    }
  };

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;
      
      if (newStatus) {
        // Online olduğunda socket bağlantısını kur ve müsaitlik durumunu güncelle
        if (token) {
          await socketService.connect(token);
        }
        if (socketService.isSocketConnected()) {
          socketService.updateAvailability(newStatus);
        }
        // Online olduğunda konum takibini başlat
        await startLocationTracking();
        // Online durumunu AsyncStorage'da sakla
        await AsyncStorage.setItem('driver_online_status', 'true');
      } else {
        // Offline olduğunda önce socket disconnect yap
        if (socketService.isSocketConnected()) {
          socketService.goOffline(); // Bu fonksiyon socket'i disconnect edecek
        }
        // Offline olduğunda konum takibini durdur
        if (locationWatchRef.current) {
          locationWatchRef.current.remove();
          locationWatchRef.current = null;
        }
        // Offline durumunu AsyncStorage'da sakla
        await AsyncStorage.setItem('driver_online_status', 'false');
      }
      
      setIsOnline(newStatus);
      
      showModal(
        'Durum Güncellendi',
        newStatus ? 'Artık çevrimiçisiniz ve konum takibi başlatıldı' : 'Çevrimdışı oldunuz ve bağlantı kesildi',
        'success'
      );
    } catch (error) {
      showModal('Hata', 'Durum güncellenirken hata oluştu.', 'error');
    }
  };

  const acceptCustomer = (customerId: number) => {
    showModal(
      'Müşteriyi Kabul Et',
      'Bu müşteriyi kabul etmek istediğinizden emin misiniz?',
      'warning',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kabul Et',
          onPress: () => {
            // Socket üzerinden sipariş kabul et
            socketService.acceptOrder(customerId);
          },
        },
      ]
    );
  };

  const updateOrderStatus = (orderId: number, status: 'started' | 'completed') => {
    const statusText = status === 'started' ? 'Yük Alındı' : 'Teslim Edildi';
    const confirmText = status === 'started' ? 'Yükü aldığınızı onaylıyor musunuz?' : 'Yükü teslim ettiğinizi onaylıyor musunuz?';
    
    showModal(
      statusText,
      confirmText,
      'warning',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Onayla',
          onPress: () => {
            // Socket üzerinden sipariş durumu güncelle
            socketService.updateOrderStatus(orderId, status);
            showModal('Başarılı', `Sipariş durumu güncellendi: ${statusText}`, 'success');
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    showModal(
      'Çıkış Yap',
      'Çıkış yapmak istediğinizden emin misiniz?',
      'warning',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          onPress: async () => {
            await logout();
            router.replace('/phone-auth');
          },
        },
      ]
    );
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'waiting': return '#FFD700';
        case 'accepted': return '#FFD700';
        case 'confirmed': return '#10B981';
        case 'in_progress': return '#3B82F6';
        case 'completed': return '#6B7280';
        default: return '#FFD700';
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case 'waiting': return 'Bekliyor';
        case 'accepted': return 'Kabul Edildi';
        case 'confirmed': return 'Onaylandı';
        case 'in_progress': return 'Devam Ediyor';
        case 'completed': return 'Tamamlandı';
        default: return 'Bekliyor';
      }
    };

    return (
      <View style={styles.customerCard}>
        <View style={styles.customerHeader}>
          <View>
            <Text style={styles.customerName}>{item.name}</Text>
            <Text style={styles.customerPhone}>{item.phone}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>
        
        <View style={styles.locationInfo}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color="#FFD700" />
            <Text style={styles.locationText}>Alış: {item.pickup_location}</Text>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="flag" size={16} color="#EF4444" />
            <Text style={styles.locationText}>Varış: {item.destination}</Text>
          </View>
        </View>
        
        <View style={styles.fareInfo}>
          <Text style={styles.distanceText}>{item.distance}</Text>
          <Text style={styles.fareText}>₺{item.estimated_fare}</Text>
        </View>
        
        {item.status === 'waiting' && (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => acceptCustomer(item.id)}
          >
            <Text style={styles.acceptButtonText}>Kabul Et</Text>
          </TouchableOpacity>
        )}
        
        {item.status === 'confirmed' && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={() => updateOrderStatus(item.id, 'started')}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Yük Aldım</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {item.status === 'in_progress' && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => updateOrderStatus(item.id, 'completed')}
            >
              <Ionicons name="flag" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Teslim Ettim</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.placeholder} />
        <Text style={styles.headerTitle}>Sürücü Paneli</Text>
        <TouchableOpacity style={styles.menuButton} onPress={() => router.push('/driver-menu')}>
          <Ionicons name="menu" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: currentLocation.latitude - 0.001,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.006,
          }}
          region={{
            latitude: currentLocation.latitude - 0.001,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.006,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          followsUserLocation={true}
          userLocationPriority="high"
          userLocationUpdateInterval={3000}
          userLocationAnnotationTitle="Konumunuz"
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          rotateEnabled={true}
        >
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            title="Konumunuz"
            description="Mevcut konum"
          />
        </MapView>
      </View>

      {/* Customer List */}
      <View style={styles.customerListContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Müşteri İstekleri</Text>
          <TouchableOpacity onPress={loadCustomers}>
            <Ionicons name="refresh" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={(customers || []).filter(c => c.status === 'waiting' || c.status === 'accepted')}
          renderItem={renderCustomerItem}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="car" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Henüz müşteri isteği yok</Text>
            </View>
          }
        />
      </View>

      {/* Hamburger Menu Modal */}
       <Modal
         visible={menuVisible}
         animationType="slide"
         transparent
         onRequestClose={() => setMenuVisible(false)}
       >
         <View style={styles.modalOverlay}>
           <View style={styles.menuContainer}>
             <View style={styles.menuHeader}>
               <View style={styles.profileSection}>
                 <View style={styles.profileImage}>
                   <Ionicons name="person" size={32} color="#FFD700" />
                 </View>
                 <View style={styles.profileInfo}>
                   {driverInfo && (
                      <Text style={styles.driverNameMenu}>
                        {`${driverInfo.first_name} ${driverInfo.last_name}`}
                      </Text>
                    )}
                   <View style={styles.ratingContainer}>
                     <Ionicons name="star" size={16} color="#FCD34D" />
                     <Text style={styles.ratingText}>4.8</Text>
                     <Text style={styles.ratingCount}>(127 değerlendirme)</Text>
                   </View>
                   <View style={[styles.statusBadgeMenu, { backgroundColor: isOnline ? '#FFD700' : '#EF4444' }]}>
                     <Text style={styles.statusBadgeText}>
                       {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                     </Text>
                   </View>
                 </View>
               </View>
               <TouchableOpacity 
                 style={styles.closeButton}
                 onPress={() => setMenuVisible(false)}
               >
                 <Ionicons name="close" size={24} color="#000000" />
               </TouchableOpacity>
             </View>

             <ScrollView style={styles.menuContent}>
               {/* Sürücü Bilgileri */}
               <TouchableOpacity 
                 style={styles.menuItem}
                 onPress={() => {
                   setMenuVisible(false);
                   router.push('/driver-profile');
                 }}
               >
                 <Ionicons name="person-outline" size={24} color="#374151" />
                 <View style={styles.menuItemContent}>
                   <Text style={styles.menuItemTitle}>Sürücü Bilgileri</Text>
                   <Text style={styles.menuItemSubtitle}>Profil bilgilerinizi görüntüleyin ve düzenleyin</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
               </TouchableOpacity>
               
               {/* Sipariş Geçmişi */}
               <TouchableOpacity 
                 style={styles.menuItem}
                 onPress={() => {
                   setMenuVisible(false);
                   router.push('/driver-order-history');
                 }}
               >
                 <Ionicons name="time-outline" size={24} color="#374151" />
                 <View style={styles.menuItemContent}>
                   <Text style={styles.menuItemTitle}>Sipariş Geçmişi</Text>
                   <Text style={styles.menuItemSubtitle}>Tamamladığınız siparişleri görüntüleyin</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
               </TouchableOpacity>
               
               {/* Kazançlar */}
               <TouchableOpacity 
                 style={styles.menuItem}
                 onPress={() => {
                   setMenuVisible(false);
                   router.push('/driver-earnings');
                 }}
               >
                 <Ionicons name="wallet-outline" size={24} color="#374151" />
                 <View style={styles.menuItemContent}>
                   <Text style={styles.menuItemTitle}>Kazançlarım</Text>
                   <Text style={styles.menuItemSubtitle}>Günlük ve aylık kazançlarınızı görüntüleyin</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
               </TouchableOpacity>
               
               {/* Değerlendirmeler */}
               <TouchableOpacity 
                 style={styles.menuItem}
                 onPress={() => {
                   setMenuVisible(false);
                   router.push('/driver-reviews');
                 }}
               >
                 <Ionicons name="star-outline" size={24} color="#374151" />
                 <View style={styles.menuItemContent}>
                   <Text style={styles.menuItemTitle}>Değerlendirmeler</Text>
                   <Text style={styles.menuItemSubtitle}>Müşteri değerlendirmelerinizi görüntüleyin</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
               </TouchableOpacity>
               
               {/* Ayarlar */}
               <TouchableOpacity 
                 style={styles.menuItem}
                 onPress={() => {
                   setMenuVisible(false);
                   router.push('/driver-settings');
                 }}
               >
                 <Ionicons name="settings-outline" size={24} color="#374151" />
                 <View style={styles.menuItemContent}>
                   <Text style={styles.menuItemTitle}>Ayarlar</Text>
                   <Text style={styles.menuItemSubtitle}>Uygulama ayarlarını düzenleyin</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
               </TouchableOpacity>
               
               {/* Yardım ve Destek */}
               <TouchableOpacity 
                 style={styles.menuItem}
                 onPress={() => {
                   setMenuVisible(false);
                   router.push('/settings');
                 }}
               >
                 <Ionicons name="help-circle-outline" size={24} color="#374151" />
                 <View style={styles.menuItemContent}>
                   <Text style={styles.menuItemTitle}>Yardım ve Destek</Text>
                   <Text style={styles.menuItemSubtitle}>SSS ve destek talebi oluşturun</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
               </TouchableOpacity>
               
               <View style={styles.menuDivider} />
               
               {/* Çıkış Yap */}
               <TouchableOpacity 
                 style={styles.menuItem}
                 onPress={() => {
                   setMenuVisible(false);
                   handleLogout();
                 }}
               >
                 <Ionicons name="log-out-outline" size={24} color="#EF4444" />
                 <View style={styles.menuItemContent}>
                   <Text style={[styles.menuItemTitle, { color: '#EF4444' }]}>Çıkış Yap</Text>
                   <Text style={styles.menuItemSubtitle}>Hesabınızdan çıkış yapın</Text>
                 </View>
               </TouchableOpacity>
             </ScrollView>
           </View>
         </View>
       </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  placeholder: {
    width: 40,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  modalOverlay: {
     flex: 1,
     backgroundColor: 'rgba(0, 0, 0, 0.5)',
     justifyContent: 'flex-end',
   },
   menuContainer: {
     backgroundColor: '#FFFFFF',
     borderTopLeftRadius: 20,
     borderTopRightRadius: 20,
     maxHeight: '80%',
   },
   menuHeader: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     paddingHorizontal: 20,
     paddingTop: 20,
     paddingBottom: 16,
     borderBottomWidth: 1,
     borderBottomColor: '#E5E7EB',
   },
   profileSection: {
     flexDirection: 'row',
     alignItems: 'center',
     flex: 1,
   },
   profileImage: {
     width: 60,
     height: 60,
     borderRadius: 30,
     backgroundColor: '#F3F4F6',
     justifyContent: 'center',
     alignItems: 'center',
     marginRight: 12,
   },
   profileInfo: {
     flex: 1,
   },
   driverNameMenu: {
     fontSize: 18,
     fontWeight: 'bold',
     color: '#000000',
     marginBottom: 4,
   },
   ratingContainer: {
     flexDirection: 'row',
     alignItems: 'center',
     marginBottom: 8,
   },
   ratingText: {
     fontSize: 14,
     fontWeight: '600',
     color: '#374151',
     marginLeft: 4,
   },
   ratingCount: {
     fontSize: 12,
     color: '#9CA3AF',
     marginLeft: 4,
   },
   statusBadgeMenu: {
     paddingHorizontal: 12,
     paddingVertical: 4,
     borderRadius: 12,
     alignSelf: 'flex-start',
   },
   statusBadgeText: {
     fontSize: 12,
     fontWeight: 'bold',
     color: '#FFFFFF',
   },
   closeButton: {
     width: 32,
     height: 32,
     borderRadius: 16,
     backgroundColor: '#F3F4F6',
     justifyContent: 'center',
     alignItems: 'center',
   },
   menuContent: {
     paddingHorizontal: 20,
     paddingBottom: 20,
   },
   menuItem: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingVertical: 16,
     borderBottomWidth: 1,
     borderBottomColor: '#F3F4F6',
   },
   menuItemContent: {
     flex: 1,
     marginLeft: 12,
   },
   menuItemTitle: {
     fontSize: 16,
     fontWeight: '600',
     color: '#374151',
     marginBottom: 2,
   },
   menuItemSubtitle: {
     fontSize: 14,
     color: '#9CA3AF',
   },
   menuDivider: {
     height: 1,
     backgroundColor: '#E5E7EB',
     marginVertical: 8,
   },
  mapContainer: {
    height: height * 0.4,
  },
  map: {
    flex: 1,
  },
  customerListContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  listContent: {
    padding: 16,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  locationInfo: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  fareInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  distanceText: {
    fontSize: 14,
    color: '#6B7280',
  },
  fareText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  acceptButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  startButton: {
    backgroundColor: '#10B981',
  },
  completeButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});