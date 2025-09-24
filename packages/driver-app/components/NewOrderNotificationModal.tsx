import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NewOrderNotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onViewOrder: () => void;
  orderData?: {
    id: number;
    pickupAddress: string;
    pickup_latitude: number;
    pickup_longitude: number;
    destinationAddress: string;
    delivery_latitude: number;
    delivery_longitude: number;
    weight: number;
    laborCount: number;
    estimatedPrice: number;
    customerId: number;
    customerName?: string;
    customerPhone?: string;
    customer_first_name?: string;
    customer_last_name?: string;
    distance?: number;
    estimatedArrival?: number;
    cargo_photo_urls?: string;
  } | null;
}

const { width, height } = Dimensions.get('window');

export default function NewOrderNotificationModal({
  visible,
  onClose,
  onViewOrder,
  orderData,
}: NewOrderNotificationModalProps) {
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (visible) {
      // Titreşim
      Vibration.vibrate([0, 500, 200, 500]);
      
      // Pulse animasyonu
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => {
        pulseAnimation.stop();
      };
    }
  }, [visible]);

  const formatDistance = (distance?: number) => {
    if (!distance) return 'Hesaplanıyor...';
    return `${distance.toFixed(1)} km`;
  };

  const formatPrice = (price?: number) => {
    if (!price) return '0';
    return `₺${price.toFixed(2)}`;
  };

  const getCustomerName = () => {
    if (orderData?.customerName) return orderData.customerName;
    if (orderData?.customer_first_name && orderData?.customer_last_name) {
      return `${orderData.customer_first_name} ${orderData.customer_last_name}`;
    }
    return 'Müşteri';
  };

  const getOrderId = () => {
    return orderData?.id || 0;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.modalContainer,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="car" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Yeni Sipariş!</Text>
            <Text style={styles.subtitle}>Yeni bir sipariş talebi geldi</Text>
          </View>

          {/* Order Details */}
          {orderData && (
            <View style={styles.orderDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="location" size={16} color="#10B981" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Alış Noktası</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>
                    {orderData.pickupAddress}
                  </Text>
                </View>
              </View>

              <View style={styles.separator} />

              <View style={styles.detailRow}>
                <Ionicons name="flag" size={16} color="#EF4444" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Varış Noktası</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>
                    {orderData.destinationAddress}
                  </Text>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Mesafe</Text>
                  <Text style={styles.infoValue}>
                    {formatDistance(orderData.distance)}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Tahmini Ücret</Text>
                  <Text style={styles.infoValue}>
                    {formatPrice(orderData.estimatedPrice)}
                  </Text>
                </View>
              </View>

              {getCustomerName() && (
                <View style={styles.customerInfo}>
                  <Ionicons name="person" size={16} color="#6B7280" />
                  <Text style={styles.customerName}>{getCustomerName()}</Text>
                </View>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.dismissButton]}
              onPress={onClose}
            >
              <Text style={styles.dismissButtonText}>Kapat</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.viewButton]}
              onPress={onViewOrder}
            >
              <Text style={styles.viewButtonText}>Siparişi Gör</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: width * 0.9,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    backgroundColor: '#FCD34D',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  iconContainer: {
    backgroundColor: '#F59E0B',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  orderDetails: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  infoGrid: {
    flexDirection: 'row',
    marginTop: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: 'bold',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  customerName: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dismissButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  viewButton: {
    backgroundColor: '#10B981',
  },
  viewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});