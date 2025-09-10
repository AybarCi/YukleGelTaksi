import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

interface DriverProfile {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  email?: string;
  license_number: string;
  vehicle_plate: string;
  vehicle_model: string;
  vehicle_year: number;
  is_active: boolean;
  rating: number;
  total_trips: number;
  profile_image?: string;
}

export default function DriverProfileScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    loadDriverProfile();
  }, []);

  const loadDriverProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Hata', 'Oturum bilgisi bulunamadı');
        return;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('API Response:', result); // Debug log
        if (result.success && result.exists && result.data) {
          const data = result.data;
          console.log('Profile data:', data); // Debug log
          setProfile({
            id: data.id,
            first_name: data.first_name,
            last_name: data.last_name,
            phone_number: data.phone_number || data.phone || '',
            email: data.email || '',
            license_number: data.license_number || '',
            vehicle_plate: data.vehicle_plate || '',
            vehicle_model: data.vehicle_model || '',
            vehicle_year: data.vehicle_year || 0,
            is_active: data.is_active,
            rating: data.rating || 0,
            total_trips: data.total_trips || 0,
            profile_image: data.profile_image
          });

        } else {
          Alert.alert('Bilgi', result.message || 'Sürücü kaydı bulunamadı');
        }
      } else {
        Alert.alert('Hata', 'Profil bilgileri alınamadı');
      }
    } catch (error) {
      console.error('Profile load error:', error);
      Alert.alert('Hata', 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const selectProfilePhoto = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri erişim izni gerekli');
        return;
      }

      // Show action sheet
      Alert.alert(
        'Profil Fotoğrafı Seç',
        'Fotoğrafı nereden seçmek istiyorsunuz?',
        [
          {
            text: 'Kamera',
            onPress: () => openCamera(),
          },
          {
            text: 'Galeri',
            onPress: () => openGallery(),
          },
          {
            text: 'İptal',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Photo selection error:', error);
      Alert.alert('Hata', 'Fotoğraf seçilirken bir hata oluştu');
    }
  };

  const openCamera = async () => {
    try {
      // İlk olarak mevcut izinleri kontrol et
      const cameraPermission = await ImagePicker.getCameraPermissionsAsync();
      let cameraStatus = cameraPermission.status;
      
      // Eğer izin verilmemişse, izin iste
      if (cameraStatus !== 'granted') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        cameraStatus = status;
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

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Hata', 'Kamera açılırken bir hata oluştu');
    }
  };

  const openGallery = async () => {
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

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Hata', 'Galeri açılırken bir hata oluştu');
    }
  };

  const uploadProfilePhoto = async (imageUri: string) => {
    try {
      setUploadingPhoto(true);
      
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Hata', 'Oturum bilgisi bulunamadı');
        return;
      }

      // Create FormData
      const formData = new FormData();
      formData.append('profile_photo', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile_photo.jpg',
      } as any);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/upload-profile-photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update profile state with new image
        setProfile(prev => prev ? {
          ...prev,
          profile_image: result.data.profile_image
        } : null);
        
        setShowSuccessModal(true);
      } else {
        Alert.alert('Hata', result.error || 'Fotoğraf yüklenirken bir hata oluştu');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Hata', 'Fotoğraf yüklenirken bir hata oluştu');
    } finally {
      setUploadingPhoto(false);
    }
  };



  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sürücü Profili</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Image */}
        <View style={styles.profileImageContainer}>
          <TouchableOpacity 
            style={styles.profileImageWrapper}
            onPress={selectProfilePhoto}
            disabled={uploadingPhoto}
          >
            <View style={styles.profileImage}>
              {profile?.profile_image && profile.profile_image.trim() !== '' ? (
                (() => {
                  // Ensure proper URL formatting
                  const imagePath = profile.profile_image.startsWith('/') ? profile.profile_image : `/api/files/${profile.profile_image}`;
                  const imageUrl = `${API_CONFIG.BASE_URL}${imagePath}`;
                  console.log('Profile image URL:', imageUrl);
                  console.log('Profile image value:', profile.profile_image);
                  console.log('API_CONFIG.BASE_URL:', API_CONFIG.BASE_URL);
                  return (
                    <Image 
                      source={{ uri: imageUrl }} 
                      style={styles.profileImageImg}
                      onError={(error) => {
                        console.log('Image load error:', error);
                        console.log('Failed URL:', imageUrl);
                      }}
                    />
                  );
                })()
              ) : (
                <Ionicons name="person" size={60} color="#FFD700" />
              )}
            </View>
            
            {/* Upload indicator or camera icon */}
            {uploadingPhoto ? (
              <View style={styles.uploadIndicator}>
                <ActivityIndicator size="small" color="#FFD700" />
              </View>
            ) : (
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={20} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={20} color="#FCD34D" />
            <Text style={styles.ratingText}>{profile?.rating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.tripsText}>({profile?.total_trips || 0} sefer)</Text>
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ad</Text>
            <Text style={styles.value}>{profile?.first_name || 'Belirtilmemiş'}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Soyad</Text>
            <Text style={styles.value}>{profile?.last_name || 'Belirtilmemiş'}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Telefon</Text>
            <Text style={styles.value}>{profile?.phone_number || 'Belirtilmemiş'}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-posta</Text>
            <Text style={styles.value}>{profile?.email || 'Belirtilmemiş'}</Text>
          </View>
        </View>

        {/* Vehicle Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Araç Bilgileri</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ehliyet Numarası</Text>
            <Text style={styles.value}>{profile?.license_number || 'Belirtilmemiş'}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Plaka</Text>
            <Text style={styles.value}>{profile?.vehicle_plate || 'Belirtilmemiş'}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Araç Modeli</Text>
            <Text style={styles.value}>{profile?.vehicle_model || 'Belirtilmemiş'}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Model Yılı</Text>
            <Text style={styles.value}>{profile?.vehicle_year || 'Belirtilmemiş'}</Text>
          </View>
        </View>

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Durum</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: profile?.is_active ? '#FFD700' : '#EF4444' }]}>
              <Text style={styles.statusText}>
                {profile?.is_active ? 'Aktif' : 'Pasif'}
              </Text>
            </View>
          </View>
        </View>


      </ScrollView>
      
      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="checkmark-circle" size={60} color="#10B981" />
            </View>
            <Text style={styles.modalTitle}>Başarılı!</Text>
            <Text style={styles.modalMessage}>
              Profil fotoğrafınız başarıyla güncellendi.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalButtonText}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileImageWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageImg: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  uploadIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginLeft: 4,
  },
  tripsText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: '#000000',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  input: {
    fontSize: 16,
    color: '#000000',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  statusContainer: {
    alignItems: 'flex-start',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalIconContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 120,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});