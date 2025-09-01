import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

interface Shipment {
  id: string;
  pickup_address: string;
  delivery_address: string;
  weight: number;
  volume: number;
  status: 'pending' | 'accepted' | 'in_progress' | 'delivered' | 'cancelled';
  created_at: string;
  driver_name?: string;
  estimated_price: number;
  actual_price?: number;
}

export default function ShipmentsScreen() {
  const { user, showModal } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual API call
      // Simulated data for now
      const mockShipments: Shipment[] = [
        {
          id: '1',
          pickup_address: 'Kadıköy, İstanbul',
          delivery_address: 'Beşiktaş, İstanbul',
          weight: 25,
          volume: 2.5,
          status: 'delivered',
          created_at: '2024-01-15T10:30:00Z',
          driver_name: 'Ahmet Yılmaz',
          estimated_price: 150,
          actual_price: 150,
        },
        {
          id: '2',
          pickup_address: 'Şişli, İstanbul',
          delivery_address: 'Ümraniye, İstanbul',
          weight: 15,
          volume: 1.8,
          status: 'in_progress',
          created_at: '2024-01-16T14:20:00Z',
          driver_name: 'Mehmet Demir',
          estimated_price: 120,
        },
        {
          id: '3',
          pickup_address: 'Bakırköy, İstanbul',
          delivery_address: 'Maltepe, İstanbul',
          weight: 30,
          volume: 3.2,
          status: 'pending',
          created_at: '2024-01-17T09:15:00Z',
          estimated_price: 180,
        },
      ];
      
      setShipments(mockShipments);
    } catch (error) {
      showModal('Hata', 'Taşımalar yüklenirken bir hata oluştu.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadShipments();
    setRefreshing(false);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Bekliyor';
      case 'accepted':
        return 'Kabul Edildi';
      case 'in_progress':
        return 'Yolda';
      case 'delivered':
        return 'Teslim Edildi';
      case 'cancelled':
        return 'İptal Edildi';
      default:
        return 'Bilinmiyor';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FFD700';
      case 'accepted':
        return '#3B82F6';
      case 'in_progress':
        return '#8B5CF6';
      case 'delivered':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'time';
      case 'accepted':
        return 'checkmark-circle';
      case 'in_progress':
        return 'car';
      case 'delivered':
        return 'checkmark-done-circle';
      case 'cancelled':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredShipments = shipments && Array.isArray(shipments) ? shipments.filter(shipment => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['pending', 'accepted', 'in_progress'].includes(shipment.status);
    if (filter === 'completed') return ['delivered', 'cancelled'].includes(shipment.status);
    return true;
  }) : [];

  const renderShipmentItem = (shipment: Shipment) => (
    <TouchableOpacity key={shipment.id} style={styles.shipmentCard}>
      <View style={styles.shipmentHeader}>
        <View style={styles.shipmentId}>
          <MaterialIcons name="local-shipping" size={20} color="#FFD700" />
          <Text style={styles.shipmentIdText}>#{shipment.id}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(shipment.status) + '20' }]}>
          <Ionicons 
            name={getStatusIcon(shipment.status) as any} 
            size={14} 
            color={getStatusColor(shipment.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(shipment.status) }]}>
            {getStatusText(shipment.status)}
          </Text>
        </View>
      </View>

      <View style={styles.addressSection}>
        <View style={styles.addressItem}>
          <View style={styles.addressIcon}>
            <Ionicons name="location" size={16} color="#10B981" />
          </View>
          <Text style={styles.addressText}>{shipment.pickup_address}</Text>
        </View>
        
        <View style={styles.routeLine} />
        
        <View style={styles.addressItem}>
          <View style={styles.addressIcon}>
            <Ionicons name="navigate" size={16} color="#EF4444" />
          </View>
          <Text style={styles.addressText}>{shipment.delivery_address}</Text>
        </View>
      </View>

      <View style={styles.shipmentDetails}>
        <View style={styles.detailItem}>
          <MaterialIcons name="fitness-center" size={16} color="#6B7280" />
          <Text style={styles.detailText}>{shipment.weight} kg</Text>
        </View>
        <View style={styles.detailItem}>
          <MaterialIcons name="inventory" size={16} color="#6B7280" />
          <Text style={styles.detailText}>{shipment.volume} m³</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="cash" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {shipment.actual_price || shipment.estimated_price} ₺
          </Text>
        </View>
      </View>

      <View style={styles.shipmentFooter}>
        <Text style={styles.dateText}>{formatDate(shipment.created_at)}</Text>
        {shipment.driver_name && (
          <Text style={styles.driverText}>Sürücü: {shipment.driver_name}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Taşımalar yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Taşımalarım</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterTab, filter === 'all' && styles.activeFilterTab]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>Tümü</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterTab, filter === 'active' && styles.activeFilterTab]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterText, filter === 'active' && styles.activeFilterText]}>Aktif</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterTab, filter === 'completed' && styles.activeFilterTab]}
          onPress={() => setFilter('completed')}
        >
          <Text 
            style={[styles.filterText, filter === 'completed' && styles.activeFilterText]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.8}
          >
            Tamamlanan
          </Text>
        </TouchableOpacity>
      </View>

      {/* Shipments List */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FFD700']} />
        }
      >
        {filteredShipments.length > 0 ? (
          <View style={styles.shipmentsList}>
            {filteredShipments.map(renderShipmentItem)}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="local-shipping" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Henüz taşıma yok</Text>
            <Text style={styles.emptyText}>
              {filter === 'all' 
                ? 'Henüz hiç taşıma siparişi vermediniz.' 
                : filter === 'active'
                ? 'Aktif taşıma siparişiniz bulunmuyor.'
                : 'Tamamlanmış taşıma siparişiniz bulunmuyor.'}
            </Text>
            <TouchableOpacity 
              style={styles.createOrderButton}
              onPress={() => router.back()}
            >
              <Text style={styles.createOrderButtonText}>Yeni Sipariş Ver</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 20,
    marginHorizontal: 2,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    minWidth: 0,
  },
  activeFilterTab: {
    backgroundColor: '#FFD700',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  shipmentsList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  shipmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  shipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shipmentId: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shipmentIdText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    maxWidth: 120,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
    flexShrink: 1,
  },
  addressSection: {
    marginBottom: 12,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#E5E7EB',
    marginLeft: 11,
    marginBottom: 8,
  },
  shipmentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 4,
    fontWeight: '500',
  },
  shipmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
  },
  driverText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  createOrderButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createOrderButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});