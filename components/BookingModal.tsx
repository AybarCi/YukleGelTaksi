import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface BookingModalProps {
  visible: boolean;
  onClose: () => void;
  bookingDetails: {
    pickup: string;
    delivery: string;
    cargoType: string;
    weight: string;
    description: string;
    estimatedPrice: number;
  };
}

export default function BookingModal({ visible, onClose, bookingDetails }: BookingModalProps) {
  const [selectedPayment, setSelectedPayment] = useState('card');
  const [isBooking, setIsBooking] = useState(false);
  const { showModal } = useAuth();

  const confirmBooking = async () => {
    setIsBooking(true);
    
    // Simulate booking process
    setTimeout(() => {
      setIsBooking(false);
      showModal(
        'Rezervasyon Onaylandı!',
        'Sürücünüz 5-10 dakika içinde size ulaşacak. Telefon numaranıza SMS ile bilgilendirme yapılacaktır.',
        'success',
        [{ text: 'Tamam', onPress: onClose }]
      );
    }, 2000);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rezervasyon Onayı</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Trip Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Seyahat Detayları</Text>
            <View style={styles.tripInfo}>
              <View style={styles.locationRow}>
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={styles.locationText}>{bookingDetails.pickup}</Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.locationRow}>
                <Text style={styles.locationIcon}>🎯</Text>
                <Text style={styles.locationText}>{bookingDetails.delivery}</Text>
              </View>
            </View>
          </View>

          {/* Cargo Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Yük Bilgileri</Text>
            <View style={styles.cargoDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tür:</Text>
                <Text style={styles.detailValue}>{bookingDetails.cargoType}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Ağırlık:</Text>
                <Text style={styles.detailValue}>{bookingDetails.weight} kg</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Açıklama:</Text>
                <Text style={styles.detailValue}>{bookingDetails.description}</Text>
              </View>
            </View>
          </View>

          {/* Estimated Time & Price */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tahminler</Text>
            <View style={styles.estimatesRow}>
              <View style={styles.estimateItem}>
                <Text style={styles.estimateIcon}>⏱️</Text>
                <Text style={styles.estimateLabel}>Varış Süresi</Text>
                <Text style={styles.estimateValue}>15-20 dk</Text>
              </View>
              <View style={styles.estimateItem}>
                <Text style={styles.estimateIcon}>🚛</Text>
                <Text style={styles.estimateLabel}>Taşıma Süresi</Text>
                <Text style={styles.estimateValue}>25-35 dk</Text>
              </View>
            </View>
          </View>

          {/* Payment Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ödeme Yöntemi</Text>
            <TouchableOpacity style={styles.paymentOption}>
              <Text style={styles.paymentIcon}>💳</Text>
              <Text style={styles.paymentText}>Kredi Kartı (...1234)</Text>
              <View style={styles.selectedPayment} />
            </TouchableOpacity>
          </View>

          {/* Price Summary */}
          <View style={styles.priceSection}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Toplam Tutar</Text>
              <Text style={styles.priceValue}>₺{bookingDetails.estimatedPrice}</Text>
            </View>
            <Text style={styles.priceNote}>
              * Ödeme iş tamamlandıktan sonra otomatik olarak çekilecektir
            </Text>
          </View>
        </ScrollView>

        {/* Confirm Button */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.confirmButton, isBooking && styles.confirmButtonLoading]}
            onPress={confirmBooking}
            disabled={isBooking}
          >
            <Text style={styles.confirmButtonText}>
              {isBooking ? 'Rezerve Ediliyor...' : 'Rezervasyonu Onayla'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 8,
  },
  closeIcon: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  locationIcon: {
    fontSize: 16,
    width: 20,
    textAlign: 'center',
  },
  estimateIcon: {
    fontSize: 20,
  },
  paymentIcon: {
    fontSize: 20,
    width: 24,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  tripInfo: {
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  routeLine: {
    marginLeft: 8,
    width: 2,
    height: 16,
    backgroundColor: '#D1D5DB',
  },
  cargoDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  estimatesRow: {
    flexDirection: 'row',
    gap: 16,
  },
  estimateItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  estimateLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  estimateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    gap: 12,
  },
  paymentText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  selectedPayment: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F97316',
  },
  priceSection: {
    paddingVertical: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F97316',
  },
  priceNote: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  confirmButton: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  confirmButtonLoading: {
    backgroundColor: '#FD853A',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});