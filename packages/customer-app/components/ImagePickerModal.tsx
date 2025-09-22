import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ImagePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onPickImage: (source: 'camera' | 'gallery') => void;
}

const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  visible,
  onClose,
  onPickImage,
}) => {
  const handlePickImage = (source: 'camera' | 'gallery') => {
    onClose();
    // Modal kapandıktan sonra image picker'ı aç
    setTimeout(() => onPickImage(source), 1000);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.imagePickerOverlay}>
        <View style={styles.imagePickerModal}>
          <View style={styles.imagePickerHeader}>
            <Text style={styles.imagePickerTitle}>Fotoğraf Seç</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.imagePickerCloseButton}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.imagePickerContent}>
            <TouchableOpacity
              style={styles.imagePickerOption}
              onPress={() => handlePickImage('camera')}
            >
              <View style={styles.imagePickerIconContainer}>
                <Ionicons name="camera" size={32} color="#10B981" />
              </View>
              <View style={styles.imagePickerOptionTextContainer}>
                 <Text style={styles.imagePickerOptionTitle}>Kamera</Text>
                 <Text style={styles.imagePickerOptionSubtitle}>Yeni fotoğraf çek</Text>
               </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.imagePickerOption}
              onPress={() => handlePickImage('gallery')}
            >
              <View style={styles.imagePickerIconContainer}>
                <Ionicons name="images" size={32} color="#F59E0B" />
              </View>
              <View style={styles.imagePickerOptionTextContainer}>
                 <Text style={styles.imagePickerOptionTitle}>Galeri</Text>
                 <Text style={styles.imagePickerOptionSubtitle}>Mevcut fotoğraflardan seç</Text>
               </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  imagePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imagePickerModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  imagePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  imagePickerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  imagePickerCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
  },
  imagePickerContent: {
    padding: 20,
    paddingTop: 10,
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  imagePickerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imagePickerOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  imagePickerOptionSubtitle: {
     fontSize: 14,
     color: '#6B7280',
   },
   imagePickerOptionTextContainer: {
    flex: 1,
  },
});

export default ImagePickerModal;