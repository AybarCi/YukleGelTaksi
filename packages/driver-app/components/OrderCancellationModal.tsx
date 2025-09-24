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

const { width } = Dimensions.get('window');

interface OrderCancellationModalProps {
  visible: boolean;
  onClose: () => void;
  orderData?: {
    orderId: number;
    message?: string;
    customerName?: string;
    pickupAddress?: string;
    destinationAddress?: string;
  } | null;
}

const OrderCancellationModal: React.FC<OrderCancellationModalProps> = ({
  visible,
  onClose,
  orderData,
}) => {
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (visible) {
      // Titreşim efekti
      Vibration.vibrate([0, 500, 200, 500]);
      
      // Pulse animasyonu
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
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
      pulse.start();

      // 5 saniye sonra otomatik kapat
      const timer = setTimeout(() => {
        pulse.stop();
        onClose();
      }, 5000);

      return () => {
        clearTimeout(timer);
        pulse.stop();
      };
    }
  }, [visible, pulseAnim, onClose]);

  const getOrderId = () => {
    return orderData?.orderId || 0;
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
              <Ionicons name="close-circle" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Sipariş İptal Edildi!</Text>
            <Text style={styles.subtitle}>Müşteri siparişi iptal etti</Text>
          </View>

          {/* Order Details */}
          {orderData && (
            <View style={styles.orderDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="receipt" size={16} color="#EF4444" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Sipariş Numarası</Text>
                  <Text style={styles.detailValue}>
                    #{getOrderId()}
                  </Text>
                </View>
              </View>

              {orderData.customerName && (
                <>
                  <View style={styles.separator} />
                  <View style={styles.detailRow}>
                    <Ionicons name="person" size={16} color="#6B7280" />
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Müşteri</Text>
                      <Text style={styles.detailValue}>
                        {orderData.customerName}
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {orderData.pickupAddress && (
                <>
                  <View style={styles.separator} />
                  <View style={styles.detailRow}>
                    <Ionicons name="location" size={16} color="#10B981" />
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Alış Noktası</Text>
                      <Text style={styles.detailValue} numberOfLines={2}>
                        {orderData.pickupAddress}
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {orderData.destinationAddress && (
                <>
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
                </>
              )}

              <View style={styles.separator} />
              <View style={styles.messageContainer}>
                <Ionicons name="information-circle" size={16} color="#F59E0B" />
                <Text style={styles.messageText}>
                  {orderData.message || 'Müşteri siparişi iptal etti.'}
                </Text>
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.closeButton]}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

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
    backgroundColor: '#EF4444',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  iconContainer: {
    backgroundColor: '#DC2626',
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
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#FEE2E2',
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
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  messageText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  actions: {
    padding: 20,
    paddingTop: 0,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    backgroundColor: '#1F2937',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OrderCancellationModal;