import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NavigationModalProps {
  visible: boolean;
  onClose: () => void;
  destination: string;
  latitude: number;
  longitude: number;
  type: 'pickup' | 'delivery';
}

export default function NavigationModal({
  visible,
  onClose,
  destination,
  latitude,
  longitude,
  type
}: NavigationModalProps) {
  
  const handleStartNavigation = async () => {
    try {
      // Google Maps URL'si oluştur
      const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        onClose(); // Modal'ı kapat
      } else {
        Alert.alert('Hata', 'Google Maps uygulaması açılamadı');
      }
    } catch (error) {
      console.error('Navigasyon hatası:', error);
      Alert.alert('Hata', 'Navigasyon başlatılamadı');
    }
  };

  const handleCancel = () => {
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
            <Ionicons 
              name={type === 'pickup' ? 'location' : 'flag'} 
              size={24} 
              color="#FFD700" 
            />
            <Text style={styles.title}>
              {type === 'pickup' ? 'Yük Alma Noktası' : 'Teslimat Noktası'}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.destinationContainer}>
              <Text style={styles.destinationLabel}>Hedef Adres:</Text>
              <Text style={styles.destinationText}>{destination}</Text>
            </View>

            <View style={styles.iconContainer}>
              <Ionicons name="navigate" size={48} color="#3B82F6" />
            </View>

            <Text style={styles.description}>
              Navigasyonu başlatmak için aşağıdaki butonu kullanın. Bu, Google Maps uygulamasını açacaktır.
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>İptal</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.startButton]} 
              onPress={handleStartNavigation}
            >
              <Ionicons name="navigate" size={20} color="#FFFFFF" />
              <Text style={styles.startButtonText}>Navigasyonu Başlat</Text>
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
  content: {
    marginBottom: 25,
  },
  destinationContainer: {
    marginBottom: 20,
  },
  destinationLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 5,
  },
  destinationText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
    lineHeight: 22,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: 20,
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
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  startButton: {
    backgroundColor: '#3B82F6',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});