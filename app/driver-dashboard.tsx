import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

interface Customer {
  id: number;
  name: string;
  phone: string;
  pickup_location: string;
  destination: string;
  distance: string;
  estimated_fare: number;
  status: 'waiting' | 'accepted' | 'in_progress' | 'completed';
  created_at: string;
}

interface DriverInfo {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  is_active: boolean;
}

export default function DriverDashboardScreen() {
  const { showModal, logout } = useAuth();
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    loadDriverInfo();
    loadCustomers();
  }, []);

  const loadDriverInfo = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/phone-auth');
        return;
      }

      const response = await fetch(`http://192.168.1.12:3001/api/drivers/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const result = await response.json();
        setDriverInfo(result.data);
        setIsOnline(result.data.is_active);
      }
    } catch (error) {
      console.log('Error loading driver info:', error);
      // Network error - logout user and redirect to login
      await logout();
      router.replace('/phone-auth');
    }
  };

  const loadCustomers = async () => {
    try {
      // Mock data - gerçek API'den gelecek
      const mockCustomers: Customer[] = [
        {
          id: 1,
          name: 'Ahmet Yılmaz',
          phone: '+90 532 123 4567',
          pickup_location: 'Taksim Meydanı',
          destination: 'Atatürk Havalimanı',
          distance: '45 km',
          estimated_fare: 120,
          status: 'waiting',
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          name: 'Fatma Demir',
          phone: '+90 533 987 6543',
          pickup_location: 'Kadıköy İskele',
          destination: 'Levent Metro',
          distance: '25 km',
          estimated_fare: 75,
          status: 'waiting',
          created_at: new Date().toISOString(),
        },
      ];
      setCustomers(mockCustomers);
    } catch (error) {
      showModal('Hata', 'Müşteri listesi alınırken hata oluştu.', 'error');
    }
  };

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;
      // API çağrısı yapılacak
      setIsOnline(newStatus);
      showModal(
        'Durum Güncellendi',
        newStatus ? 'Artık çevrimiçisiniz' : 'Çevrimdışı oldunuz',
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
            setCustomers(prev =>
              prev.map(customer =>
                customer.id === customerId
                  ? { ...customer, status: 'accepted' }
                  : customer
              )
            );
            showModal('Başarılı', 'Müşteri kabul edildi!', 'success');
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
        case 'waiting': return '#F59E0B';
        case 'accepted': return '#10B981';
        case 'in_progress': return '#3B82F6';
        case 'completed': return '#6B7280';
        default: return '#F59E0B';
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case 'waiting': return 'Bekliyor';
        case 'accepted': return 'Kabul Edildi';
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
            <Ionicons name="location" size={16} color="#10B981" />
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
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>
            {driverInfo ? `${driverInfo.first_name} ${driverInfo.last_name}` : 'Sürücü'}
          </Text>
          <TouchableOpacity
            style={[styles.statusButton, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]}
            onPress={toggleOnlineStatus}
          >
            <Text style={styles.statusButtonText}>
              {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={currentLocation}
          showsUserLocation={true}
          showsMyLocationButton={true}
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
          data={customers.filter(c => c.status === 'waiting' || c.status === 'accepted')}
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
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#10B981',
  },
  acceptButton: {
    backgroundColor: '#10B981',
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
});