import React, { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NewOrderCreatedModalProps {
  visible: boolean;
  onClose: () => void;
  orderData?: {
    id: number;
    pickupAddress: string;
    destinationAddress: string;
    estimatedPrice: number;
    distance?: number;
  } | null;
}

const NewOrderCreatedModal: React.FC<NewOrderCreatedModalProps> = ({
  visible,
  onClose,
  orderData,
}) => {
  useEffect(() => {
    // NewOrderCreatedModal useEffect triggered
    if (visible) {
      // Modal is visible, triggering vibration
      // Titreşim efekti
      Vibration.vibrate([0, 200, 100, 200]);
    }
  }, [visible, orderData]);

  // NewOrderCreatedModal render
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Success Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Sipariş Oluşturuldu!</Text>

          {/* Message */}
          <Text style={styles.message}>
            Siparişiniz başarıyla oluşturuldu. Sürücü araması başlatıldı.
          </Text>

          {/* Order Details */}
          {orderData ? (
            <View style={styles.orderDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Sipariş No:</Text>
                <Text style={styles.detailValue}>#{orderData.id || 'N/A'}</Text>
              </View>
              
              <View style={styles.locationContainer}>
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={16} color="#10B981" />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {orderData.pickupAddress || 'Adres belirtilmemiş'}
                  </Text>
                </View>
                
                <View style={styles.routeLine} />
                
                <View style={styles.locationRow}>
                  <Ionicons name="flag" size={16} color="#EF4444" />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {orderData.destinationAddress || 'Adres belirtilmemiş'}
                  </Text>
                </View>
              </View>

              <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>Tahmini Ücret</Text>
                <Text style={styles.priceValue}>₺{orderData.estimatedPrice || 0}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.orderDetails}>
              <Text style={styles.message}>Sipariş detayları yükleniyor...</Text>
            </View>
          )}

          {/* Close Button */}
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Tamam</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  orderDetails: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  locationContainer: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  routeLine: {
    marginLeft: 8,
    width: 2,
    height: 16,
    backgroundColor: '#D1D5DB',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  priceLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 18,
    color: '#10B981',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NewOrderCreatedModal;