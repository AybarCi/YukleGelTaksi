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
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG } from '../config/api';

interface Shipment {
  id: number;
  pickup_address: string;
  destination_address: string;
  distance_km: number;
  weight_kg: number;
  labor_count: number;
  cargo_photo_urls?: string;
  base_price: number;
  distance_price: number;
  weight_price: number;
  labor_price: number;
  total_price: number;
  payment_method?: string;
  status: 'pending' | 'driver_accepted_awaiting_customer' | 'confirmed' | 'driver_going_to_pickup' | 'pickup_completed' | 'in_transit' | 'delivered' | 'payment_completed' | 'cancelled';
  customer_notes?: string;
  driver_notes?: string;
  cancel_reason?: string;
  created_at: string;
  accepted_at?: string;
  confirmed_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  updated_at: string;
  driver?: {
    first_name: string;
    last_name: string;
    phone: string;
    vehicle_plate: string;
    vehicle_model: string;
    vehicle_color: string;
    rating: number;
  } | null;
}

const { width } = Dimensions.get('window');

export default function ShipmentsScreen() {
  const { user, showModal } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    try {
      setIsLoading(true);
      
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        setShipments([]);
        return;
      }

      // Filter'a göre status parametresi belirle
      let statusParam = '';
      if (filter === 'active') {
        statusParam = 'pending,driver_accepted_awaiting_customer,confirmed,driver_going_to_pickup,pickup_completed,in_transit';
      } else if (filter === 'completed') {
        statusParam = 'delivered,payment_completed,cancelled';
      }

      const url = `${API_CONFIG.BASE_URL}/api/users/orders${
        statusParam ? `?status=${statusParam}` : ''
      }`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.orders) {
          setShipments(data.data.orders);
        } else {
          setShipments([]);
        }
      } else {
        setShipments([]);
      }
    } catch (error) {
      console.error('Shipments load error:', error);
      setShipments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadShipments();
    setRefreshing(false);
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

  const openDetailModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedShipment(null);
  };

  const openImageModal = (index: number) => {
    setSelectedImageIndex(index);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': 'Beklemede',
      'driver_accepted_awaiting_customer': 'Sürücü Kabul Etti',
      'confirmed': 'Onaylandı',
      'driver_going_to_pickup': 'Sürücü Yolda',
      'pickup_completed': 'Alım Tamamlandı',
      'in_transit': 'Yolda',
      'delivered': 'Teslim Edildi',
      'payment_completed': 'Ödeme Tamamlandı',
      'cancelled': 'İptal Edildi'
    };
    return statusMap[status] || status;
  };

  const renderShipmentItem = (shipment: Shipment) => (
    <TouchableOpacity key={shipment.id} style={styles.shipmentCard} onPress={() => openDetailModal(shipment)}>
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
          <Text style={styles.addressText}>{shipment.destination_address}</Text>
        </View>
      </View>

      <View style={styles.shipmentDetails}>
        <View style={styles.detailItem}>
          <MaterialIcons name="fitness-center" size={16} color="#6B7280" />
          <Text style={styles.detailText}>{shipment.weight_kg} kg</Text>
        </View>
        <View style={styles.detailItem}>
          <MaterialIcons name="people" size={16} color="#6B7280" />
          <Text style={styles.detailText}>{shipment.labor_count} işçi</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="cash" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {shipment.total_price} ₺
          </Text>
        </View>
      </View>

      <View style={styles.shipmentFooter}>
        <Text style={styles.dateText}>{formatDate(shipment.created_at)}</Text>
        {shipment.driver && (
          <Text style={styles.driverText}>Sürücü: {shipment.driver.first_name} {shipment.driver.last_name}</Text>
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

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetailModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeDetailModal} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Sipariş Detayı</Text>
            <View style={styles.placeholder} />
          </View>

          {selectedShipment && (
            <ScrollView style={styles.modalContent}>
              {/* Order Info */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Sipariş Bilgileri</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Sipariş ID:</Text>
                  <Text style={styles.infoValue}>#{selectedShipment.id}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Durum:</Text>
                  <Text style={styles.infoValue}>{getStatusText(selectedShipment.status)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Toplam Tutar:</Text>
                  <Text style={styles.infoValue}>{selectedShipment.total_price} TL</Text>
                </View>
              </View>

              {/* Addresses */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Adresler</Text>
                <View style={styles.addressItem}>
                  <View style={styles.addressIcon}>
                    <Ionicons name="location" size={16} color="#10B981" />
                  </View>
                  <Text style={styles.addressText}>{selectedShipment.pickup_address}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.addressItem}>
                  <View style={styles.addressIcon}>
                    <Ionicons name="flag" size={16} color="#EF4444" />
                  </View>
                  <Text style={styles.addressText}>{selectedShipment.destination_address}</Text>
                </View>
              </View>

              {/* Cargo Photos */}
              {selectedShipment.cargo_photo_urls && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Kargo Fotoğrafları</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
                    {(() => {
                      try {
                        const photoUrls = typeof selectedShipment.cargo_photo_urls === 'string' 
                          ? JSON.parse(selectedShipment.cargo_photo_urls) 
                          : selectedShipment.cargo_photo_urls;
                        const urlArray = Array.isArray(photoUrls) ? photoUrls : photoUrls.split(',');
                        return urlArray.map((url: string, index: number) => (
                          <TouchableOpacity
                            key={index}
                            onPress={() => openImageModal(index)}
                            style={styles.photoThumbnail}
                          >
                            <Image
                              source={{ uri: url.trim() }}
                              style={styles.thumbnailImage}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        ));
                      } catch (error) {
                        console.error('Fotoğraf URL\'leri parse edilemedi:', error);
                        return null;
                      }
                    })()}
                  </ScrollView>
                </View>
              )}

              {/* Notes */}
              {selectedShipment.customer_notes && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Müşteri Notları</Text>
                  <Text style={styles.noteText}>{selectedShipment.customer_notes}</Text>
                </View>
              )}

              {selectedShipment.driver_notes && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Sürücü Notları</Text>
                  <Text style={styles.noteText}>{selectedShipment.driver_notes}</Text>
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        animationType="fade"
        transparent={true}
        onRequestClose={closeImageModal}
      >
        <View style={styles.imageModalContainer}>
          <TouchableOpacity
            style={styles.imageModalOverlay}
            onPress={closeImageModal}
          >
            <View style={styles.imageModalContent}>
              <TouchableOpacity onPress={closeImageModal} style={styles.imageCloseButton}>
                <Ionicons name="close" size={30} color="#fff" />
              </TouchableOpacity>
              {selectedShipment && selectedShipment.cargo_photo_urls && (() => {
                try {
                  const photoUrls = typeof selectedShipment.cargo_photo_urls === 'string' 
                    ? JSON.parse(selectedShipment.cargo_photo_urls) 
                    : selectedShipment.cargo_photo_urls;
                  const urlArray = Array.isArray(photoUrls) ? photoUrls : photoUrls.split(',');
                  const imageUrl = urlArray[selectedImageIndex]?.trim();
                  return imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.fullImage}
                      resizeMode="contain"
                    />
                  ) : null;
                } catch (error) {
                  console.error('Fotoğraf URL parse edilemedi:', error);
                  return null;
                }
              })()}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
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
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  photosContainer: {
    marginTop: 8,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  noteText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalOverlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: width * 0.9,
    height: width * 0.9,
    position: 'relative',
  },
  imageCloseButton: {
    position: 'absolute',
    top: -50,
    right: 0,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});