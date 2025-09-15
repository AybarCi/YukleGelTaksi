import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface Customer {
  id: number;
  name: string;
  phone: string;
  pickup_location: string;
  destination: string;
  distance: string;
  estimated_fare: number;
  status: 'waiting' | 'accepted' | 'confirmed' | 'in_progress' | 'completed' | 'inspecting';
  created_at: string;
}

interface CustomerListProps {
  customers: Customer[];
  onInspectOrder: (customer: Customer) => void;
  onUpdateOrderStatus: (orderId: number, status: string) => void;
  inspectingOrders: Set<number>;
  maskPhoneNumber: (phone: string) => string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const CustomerList: React.FC<CustomerListProps> = ({
  customers,
  onInspectOrder,
  onUpdateOrderStatus,
  inspectingOrders,
  maskPhoneNumber,
  onRefresh,
  isRefreshing = false,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return '#FFD700';
      case 'accepted': return '#FFD700';
      case 'confirmed': return '#10B981';
      case 'in_progress': return '#3B82F6';
      case 'completed': return '#6B7280';
      case 'inspecting': return '#F59E0B';
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
      case 'inspecting': return 'İnceleniyor';
      default: return 'Bekliyor';
    }
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => (
    <View style={styles.customerCard}>
      <View style={styles.customerHeader}>
        <View>
          <Text style={styles.customerName}>{item.name}</Text>
          <Text style={styles.customerPhone}>{maskPhoneNumber(item.phone)}</Text>
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
          style={[styles.actionButton, styles.inspectButton, { marginHorizontal: 0 }]}
          onPress={() => onInspectOrder(item)}
          disabled={inspectingOrders.has(item.id)}
        >
          <Ionicons name="eye" size={16} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>
            {inspectingOrders.has(item.id) ? 'İnceleniyor...' : 'İncele'}
          </Text>
        </TouchableOpacity>
      )}
      
      {item.status === 'inspecting' && (
        <View style={[styles.actionButton, { backgroundColor: '#F59E0B', marginHorizontal: 0 }]}>
          <Ionicons name="eye" size={16} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>İnceleme Devam Ediyor</Text>
        </View>
      )}
      
      {item.status === 'confirmed' && (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton]}
            onPress={() => onUpdateOrderStatus(item.id, 'started')}
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
            onPress={() => onUpdateOrderStatus(item.id, 'completed')}
          >
            <Ionicons name="flag" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Teslim Ettim</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

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
        data={customers}
        renderItem={renderCustomerItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
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
});

export default CustomerList;