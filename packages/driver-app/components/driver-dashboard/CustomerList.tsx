import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTurkishLira } from '../../app/utils/currencyUtils';

const { width } = Dimensions.get('window');

interface Customer {
  id: number;
  name: string;
  phone: string;
  pickup_location: string;
  destination: string;
  distance: string;
  estimated_fare: number;
  status: 'pending' | 'waiting' | 'driver_accepted_awaiting_customer' | 'accepted' | 'confirmed' | 'in_progress' | 'completed' | 'inspecting' | 'rejected' | 'timeout';
  created_at: string;
  countdownTime?: number; // Geri sayım süresi (milisaniye)
  countdownTotal?: number; // Toplam süre (milisaniye)
}

interface CustomerListProps {
  customers: Customer[];
  onInspectOrder: (customer: Customer) => void;
  onUpdateOrderStatus: (orderId: number, status: string) => void;
  inspectingOrders: Set<number>;
  maskPhoneNumber: (phone: string) => string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isOnline?: boolean;
}

const CustomerList: React.FC<CustomerListProps> = ({
  customers,
  onInspectOrder,
  onUpdateOrderStatus,
  inspectingOrders,
  maskPhoneNumber,
  onRefresh,
  isRefreshing = false,
  isOnline = true,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFD700';
      case 'waiting': return '#FFD700';
      case 'driver_accepted_awaiting_customer': return '#FF6B35';
      case 'accepted': return '#FFD700';
      case 'confirmed': return '#10B981';
      case 'in_progress': return '#3B82F6';
      case 'completed': return '#6B7280';
      case 'inspecting': return '#F59E0B';
      case 'rejected': return '#EF4444';
      case 'timeout': return '#9CA3AF';
      default: return '#FFD700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Bekliyor';
      case 'waiting': return 'Sırada';
      case 'driver_accepted_awaiting_customer': return 'Müşteri Onayı';
      case 'accepted': return 'Kabul Edildi';
      case 'confirmed': return 'Onaylandı';
      case 'in_progress': return 'Yolda';
      case 'completed': return 'Tamamlandı';
      case 'inspecting': return 'İnceleniyor';
      case 'rejected': return 'Reddedildi';
      case 'timeout': return 'Süre Doldu';
      default: return 'Bekliyor';
    }
  };

  const CountdownTimer = ({ remainingTime, totalTime }: { remainingTime: number, totalTime: number }) => {
    const [timeLeft, setTimeLeft] = useState(remainingTime);
    
    useEffect(() => {
      setTimeLeft(remainingTime);
      
      if (remainingTime <= 0) return;
      
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1000;
          return newTime <= 0 ? 0 : newTime;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }, [remainingTime]);
    
    const formatTime = (ms: number) => {
      const seconds = Math.ceil(ms / 1000);
      return `${seconds}s`;
    };
    
    const progress = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
    const isUrgent = timeLeft <= 10000; // 10 saniye kaldığında
    
    return (
      <View style={styles.countdownContainer}>
        <View style={styles.countdownProgressBar}>
          <View 
            style={[
              styles.countdownProgressFill, 
              { width: `${progress}%`, backgroundColor: isUrgent ? '#EF4444' : '#10B981' }
            ]} 
          />
        </View>
        <Text style={[styles.countdownText, isUrgent && styles.countdownTextUrgent]}>
          {formatTime(timeLeft)}
        </Text>
      </View>
    );
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => {
    // Null/undefined kontrolü
    if (!item) {
      console.warn('🚨 CustomerList: Null item received');
      return null;
    }
    
    // Gerekli alanların varlığını kontrol et
    const safeName = item.name || 'İsimsiz Müşteri';
    const safePhone = item.phone || 'Telefon yok';
    const safePickupLocation = item.pickup_location || 'Adres belirtilmemiş';
    const safeDestination = item.destination || 'Varış belirtilmemiş';
    const safeDistance = item.distance || '0 km';
    const safeEstimatedFare = item.estimated_fare || 0;
    const safeStatus = item.status || 'pending';
    const safeId = item.id || Date.now();
    
    return (
      <View style={styles.customerCard}>
        <View style={styles.customerHeader}>
          <View>
            <Text style={styles.customerName}>{safeName}</Text>
            <Text style={styles.customerPhone}>{maskPhoneNumber(safePhone)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(safeStatus) }]}>
            <Text style={styles.statusText}>{getStatusText(safeStatus)}</Text>
          </View>
        </View>
        
        {safeStatus === 'driver_accepted_awaiting_customer' && item.countdownTime !== undefined && (
          <View style={styles.countdownWrapper}>
            <Text style={styles.countdownLabel}>Müşteri Onayı İçin Kalan Süre:</Text>
            <CountdownTimer 
              remainingTime={item.countdownTime} 
              totalTime={item.countdownTotal || 60000} 
            />
          </View>
        )}
        
        <View style={styles.locationInfo}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color="#FFD700" />
            <Text style={styles.locationText}>Alış: {safePickupLocation}</Text>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="flag" size={16} color="#EF4444" />
            <Text style={styles.locationText}>Varış: {safeDestination}</Text>
          </View>
        </View>
        
        <View style={styles.fareInfo}>
          <Text style={styles.distanceText}>{safeDistance}</Text>
          <Text style={styles.fareText}>{formatTurkishLira(safeEstimatedFare)}</Text>
        </View>
      
        {(safeStatus === 'pending') && (
          <TouchableOpacity
            style={[
              styles.actionButton, 
              styles.inspectButton, 
              { marginHorizontal: 0 },
              (!isOnline || inspectingOrders.has(safeId)) && { backgroundColor: '#9CA3AF' }
            ]}
            onPress={() => onInspectOrder(item)}
            disabled={!isOnline || inspectingOrders.has(safeId)}
          >
            <Ionicons name="eye" size={16} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              {!isOnline ? 'Çevrimdışı' : inspectingOrders.has(safeId) ? 'İnceleniyor...' : 'İncele'}
            </Text>
          </TouchableOpacity>
        )}
        
        {safeStatus === 'inspecting' && (
          <View style={[styles.actionButton, { backgroundColor: '#F59E0B', marginHorizontal: 0 }]}>
            <Ionicons name="eye" size={16} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>İnceleme Devam Ediyor</Text>
          </View>
        )}
        
        {safeStatus === 'confirmed' && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={() => onUpdateOrderStatus(safeId, 'started')}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Yük Aldım</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {safeStatus === 'in_progress' && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => onUpdateOrderStatus(safeId, 'completed')}
            >
              <Ionicons name="flag" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Teslim Ettim</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="car-outline" size={64} color="#9CA3AF" />
      <Text style={styles.emptyText}>Henüz müşteri yok</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Müşteriler ({customers.length})</Text>
        {onRefresh && (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={isRefreshing}
          >
            <Ionicons 
              name="refresh" 
              size={20} 
              color={isRefreshing ? "#9CA3AF" : "#FFD700"} 
            />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={customers || []}
        renderItem={renderCustomerItem}
        keyExtractor={(item, index) => {
          if (!item) {
            console.warn('🚨 CustomerList: Null item in keyExtractor at index', index);
            return `null-item-${index}-${Date.now()}`;
          }
          const key = item.id?.toString() || `customer-${index}-${Date.now()}-${Math.random()}`;
          return key;
        }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        removeClippedSubviews={false}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={10}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
  inspectButton: {
    backgroundColor: '#3B82F6',
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  
  // Countdown styles
  countdownWrapper: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  countdownLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '600',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countdownProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginRight: 12,
    overflow: 'hidden',
  },
  countdownProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  countdownText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    minWidth: 40,
    textAlign: 'right',
  },
  countdownTextUrgent: {
    color: '#EF4444',
  },
});

export default CustomerList;