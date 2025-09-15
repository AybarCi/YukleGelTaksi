import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OrderData } from '../../types/dashboard';

interface ActiveOrderCardProps {
  activeOrder: OrderData;
  currentPhase: 'pickup' | 'delivery';
  routeDuration?: number;
  onPickupComplete: (orderId: number) => void;
  onDeliveryComplete: (orderId: number) => void;
}

export const ActiveOrderCard: React.FC<ActiveOrderCardProps> = ({
  activeOrder,
  currentPhase,
  routeDuration,
  onPickupComplete,
  onDeliveryComplete,
}) => {
  const handlePhoneCall = () => {
    const phoneNumber = activeOrder.customerPhone?.replace(/[^0-9]/g, '');
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    }
  };

  return (
    <View style={styles.activeOrderContainer}>
      <View style={styles.activeOrderHeader}>
        <Text style={styles.activeOrderTitle}>
          {currentPhase === 'pickup' ? 'Yük Alma' : 'Teslimat'} - {activeOrder.customerName}
        </Text>
        <View style={[styles.phaseIndicator, { backgroundColor: currentPhase === 'pickup' ? '#10B981' : '#EF4444' }]}>
          <Text style={styles.phaseIndicatorText}>
            {currentPhase === 'pickup' ? 'Yük Alma' : 'Teslimat'}
          </Text>
        </View>
      </View>
      
      <View style={styles.activeOrderInfo}>
        <View style={styles.activeOrderRow}>
          <Ionicons name="location" size={16} color="#6B7280" />
          <Text style={styles.activeOrderText}>
            {currentPhase === 'pickup' ? activeOrder.pickupAddress : activeOrder.destinationAddress}
          </Text>
        </View>
        
        {routeDuration && (
          <View style={styles.activeOrderRow}>
            <Ionicons name="time" size={16} color="#6B7280" />
            <Text style={styles.activeOrderText}>
              Tahmini Süre: {Math.round(routeDuration / 60)} dakika
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.activeOrderActions}>
        {currentPhase === 'pickup' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.pickupButton]}
            onPress={() => onPickupComplete(activeOrder.id)}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Yük Alındı</Text>
          </TouchableOpacity>
        )}
        
        {currentPhase === 'delivery' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deliveryButton]}
            onPress={() => onDeliveryComplete(activeOrder.id)}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Teslim Edildi</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.actionButton, styles.callButton]}
          onPress={handlePhoneCall}
        >
          <Ionicons name="call" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Ara</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  activeOrderContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  activeOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeOrderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
  },
  phaseIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  phaseIndicatorText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  activeOrderInfo: {
    marginBottom: 16,
  },
  activeOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeOrderText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  activeOrderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  pickupButton: {
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  deliveryButton: {
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  callButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});