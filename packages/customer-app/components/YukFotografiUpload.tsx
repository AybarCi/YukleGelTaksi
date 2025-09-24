import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

interface YukFotografiUploadProps {
  onPhotoSelect: (photoUri: string) => void;
  selectedPhoto?: string;
  required?: boolean;
}

const YukFotografiUpload: React.FC<YukFotografiUploadProps> = ({
  onPhotoSelect,
  selectedPhoto,
  required = true,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert(
        'İzin Gerekli',
        'Fotoğraf çekebilmek için kamera ve galeri izinleri gereklidir. Ayarlardan izinleri açabilirsiniz.',
        [
          { text: 'İptal', style: 'cancel' },
          { 
            text: 'Ayarlara Git', 
            onPress: () => Linking.openSettings() 
          }
        ]
      );
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    setShowOptions(false);
    
    try {
      // İlk olarak mevcut izinleri kontrol et
      const cameraPermission = await ImagePicker.getCameraPermissionsAsync();
      const mediaPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
      
      let cameraStatus = cameraPermission.status;
      let mediaStatus = mediaPermission.status;
      
      // Eğer izin verilmemişse, izin iste
      if (cameraStatus !== 'granted') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        cameraStatus = status;
      }
      
      if (mediaStatus !== 'granted') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        mediaStatus = status;
      }
      
      // İzin verilmediyse kullanıcıyı uyar
      if (cameraStatus !== 'granted') {
        Alert.alert(
          'Kamera İzni Gerekli',
          'Fotoğraf çekebilmek için kamera izni gereklidir. Ayarlardan izni açabilirsiniz.',
          [
            { text: 'İptal', style: 'cancel' },
            { 
              text: 'Ayarlara Git', 
              onPress: () => Linking.openSettings() 
            }
          ]
        );
        return;
      }

      setIsUploading(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const photoUri = result.assets[0].uri;
        // Photo taken
        onPhotoSelect(photoUri);
      }
    } catch (error) {
      console.error('Fotoğraf çekme hatası:', error);
      Alert.alert('Hata', 'Fotoğraf çekilirken bir hata oluştu.');
    } finally {
      setIsUploading(false);
    }
  };

  const pickFromGallery = async () => {
    setShowOptions(false);
    
    try {
      // İlk olarak mevcut izinleri kontrol et
      const mediaPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
      
      let mediaStatus = mediaPermission.status;
      
      // Eğer izin verilmemişse, izin iste
      if (mediaStatus !== 'granted') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        mediaStatus = status;
      }
      
      // İzin verilmediyse kullanıcıyı uyar
      if (mediaStatus !== 'granted') {
        Alert.alert(
          'Galeri İzni Gerekli',
          'Fotoğraf seçebilmek için galeri izni gereklidir. Ayarlardan izni açabilirsiniz.',
          [
            { text: 'İptal', style: 'cancel' },
            { 
              text: 'Ayarlara Git', 
              onPress: () => Linking.openSettings() 
            }
          ]
        );
        return;
      }

      setIsUploading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const photoUri = result.assets[0].uri;
        // Photo selected from gallery
        onPhotoSelect(photoUri);
      }
    } catch (error) {
      console.error('Galeri seçme hatası:', error);
      Alert.alert('Hata', 'Fotoğraf seçilirken bir hata oluştu.');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = () => {
    Alert.alert(
      'Fotoğrafı Kaldır',
      'Seçilen fotoğrafı kaldırmak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Kaldır', 
          style: 'destructive',
          onPress: () => onPhotoSelect('') 
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <Ionicons name="camera-outline" size={20} color="#8B5CF6" />
          <Text style={styles.headerText}>Yük Fotoğrafı</Text>
          {required && <Text style={styles.requiredText}>*</Text>}
        </View>
      </View>
      
      <Text style={styles.description}>
        Sürücünün yükünüzü değerlendirebilmesi için fotoğraf gereklidir.
      </Text>

      {selectedPhoto ? (
        <View style={styles.photoContainer}>
          <Image source={{ uri: selectedPhoto }} style={styles.photoPreview} />
          <View style={styles.photoActions}>
            <TouchableOpacity 
              style={styles.changePhotoButton}
              onPress={() => setShowOptions(true)}
            >
              <Ionicons name="camera" size={16} color="#FFFFFF" />
              <Text style={styles.changePhotoText}>Değiştir</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.removePhotoButton}
              onPress={removePhoto}
            >
              <Ionicons name="trash" size={16} color="#FFFFFF" />
              <Text style={styles.removePhotoText}>Kaldır</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={() => setShowOptions(true)}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#8B5CF6" />
          ) : (
            <>
              <Ionicons name="camera" size={32} color="#8B5CF6" />
              <Text style={styles.uploadText}>Fotoğraf Ekle</Text>
              <Text style={styles.uploadSubText}>Kameradan çek veya galeriden seç</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Options Modal */}
      <Modal
        visible={showOptions}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Fotoğraf Seç</Text>
            
            <TouchableOpacity style={styles.optionButton} onPress={takePhoto}>
              <Ionicons name="camera" size={24} color="#8B5CF6" />
              <Text style={styles.optionText}>Kameradan Çek</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.optionButton} onPress={pickFromGallery}>
              <Ionicons name="images" size={24} color="#8B5CF6" />
              <Text style={styles.optionText}>Galeriden Seç</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setShowOptions(false)}
            >
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  requiredText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: '#8B5CF6',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
    marginTop: 8,
  },
  uploadSubText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  photoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  photoActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  changePhotoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  changePhotoText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  removePhotoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  removePhotoText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
});

export default YukFotografiUpload;