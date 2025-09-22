import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DriverNotFoundModalProps {
  visible: boolean;
  onClose: () => void;
  estimatedWaitTime?: number;
  message?: string;
}

const { width } = Dimensions.get('window');

export default function DriverNotFoundModal({
  visible,
  onClose,
  estimatedWaitTime,
  message,
}: DriverNotFoundModalProps) {
  if (!visible) {
    return null;
  }

  const defaultMessage = estimatedWaitTime 
    ? `Şu anda yakınınızda müsait sürücü bulunmamaktadır. Tahmini bekleme süresi: ${estimatedWaitTime} dakika.`
    : 'Şu anda yakınınızda müsait sürücü bulunmamaktadır. Lütfen daha sonra tekrar deneyiniz.';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="warning"
              size={48}
              color="#F59E0B"
            />
          </View>
          
          <Text style={styles.title}>Yakın Sürücü Bulunamadı</Text>
          <Text style={styles.message}>
            {message || defaultMessage}
          </Text>
          
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: width * 0.85,
    maxWidth: 350,
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
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonsContainer: {
    width: '100%',
  },
  button: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});