import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PriceConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  orderId: number;
  finalPrice: number;
  laborCount: number;
  estimatedPrice: number;
  priceDifference: number;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void; // Yeni prop - iptal modalını açmak için
  timeout?: number; // Geri sayım süresi (milisaniye cinsinden)
}

export default function PriceConfirmationModal({
  visible,
  onClose,
  orderId,
  finalPrice,
  laborCount,
  estimatedPrice,
  priceDifference,
  onAccept,
  onReject,
  onCancel,
  timeout = 60000 // Varsayılan 60 saniye
}: PriceConfirmationModalProps) {
  const [timeLeft, setTimeLeft] = useState(Math.ceil(timeout / 1000)); // Saniye cinsinden kalan süre

  // Geri sayım zamanlayıcısı
  useEffect(() => {
    if (!visible) return;

    setTimeLeft(Math.ceil(timeout / 1000));
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Süre doldu, otomatik olarak reddet
          onReject();
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, timeout, onReject, onClose]);

  const handleAccept = () => {
    onAccept();
    onClose();
  };

  const handleReject = () => {
    onReject();
    onClose();
  };

  return (
    <Modal
      transparent={true}
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Ionicons name="cash" size={24} color="#FFD700" />
            <Text style={styles.title}>Fiyat Onayı Gerekli</Text>
            <View style={styles.countdownContainer}>
              <Ionicons name="time-outline" size={16} color="#EF4444" />
              <Text style={[styles.countdownText, timeLeft <= 10 && styles.countdownTextUrgent]}>
                {timeLeft}s
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.infoContainer}>
              <Text style={styles.infoLabel}>Sipariş ID:</Text>
              <Text style={styles.infoValue}>#{orderId}</Text>
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.infoLabel}>Tahmini Fiyat:</Text>
              <Text style={styles.infoValue}>₺{estimatedPrice}</Text>
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.infoLabel}>İşçilik Sayısı:</Text>
              <Text style={styles.infoValue}>{laborCount} kişi</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.finalPriceContainer}>
              <Text style={styles.finalPriceLabel}>Nihai Fiyat:</Text>
              <Text style={styles.finalPrice}>₺{finalPrice}</Text>
            </View>

            {priceDifference !== 0 && (
              <View style={styles.priceDifferenceContainer}>
                <Ionicons 
                  name={priceDifference > 0 ? "trending-up" : "trending-down"} 
                  size={16} 
                  color={priceDifference > 0 ? "#EF4444" : "#10B981"} 
                />
                <Text style={[
                  styles.priceDifferenceText,
                  { color: priceDifference > 0 ? '#EF4444' : '#10B981' }
                ]}>
                  {priceDifference > 0 ? '+' : ''}₺{Math.abs(priceDifference)} fark
                </Text>
              </View>
            )}

            <Text style={styles.description}>
              Sürücü işçilik sayısını güncelledi. Yeni fiyatı onaylıyor musunuz?
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.rejectButton]} 
              onPress={handleReject}
            >
              <Ionicons name="close-circle" size={20} color="#FFFFFF" />
              <Text style={styles.rejectButtonText}>Reddet</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.acceptButton]} 
              onPress={handleAccept}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.acceptButtonText}>Onayla</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    marginLeft: 10,
  },
  closeButton: {
    padding: 5,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  countdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 4,
  },
  countdownTextUrgent: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    marginBottom: 25,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 15,
  },
  finalPriceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  finalPriceLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  finalPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  priceDifferenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    gap: 5,
  },
  priceDifferenceText: {
    fontSize: 14,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  rejectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});