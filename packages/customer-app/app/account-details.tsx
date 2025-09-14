import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG } from '../config/api';

export default function AccountDetailsScreen() {
  const { user, logout, showModal } = useAuth();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Belirtilmemiş';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Load profile image on component mount
  useEffect(() => {
    loadProfileImage();
  }, []);

  const loadProfileImage = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/customer/profile/photo`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Profile image API response:', data);
        console.log('API_CONFIG.BASE_URL:', API_CONFIG.BASE_URL);
        if (data.success && data.data && data.data.profile_image_url) {
          console.log('Raw profile_image_url from API:', data.data.profile_image_url);
          // Cache busting için timestamp ekle
          const timestamp = new Date().getTime();
          const fullImageUrl = `${API_CONFIG.BASE_URL}${data.data.profile_image_url}?t=${timestamp}`;
          console.log('Full image URL constructed with timestamp:', fullImageUrl);
          console.log('Setting profile image state with URL:', fullImageUrl);
          setProfileImage(fullImageUrl);
        } else {
          console.log('No profile image found or API error');
          console.log('data.success:', data.success);
          console.log('data.data:', data.data);
          console.log('data.data?.profile_image_url:', data.data?.profile_image_url);
          setProfileImage(null);
        }
      } else {
        console.log('Profile image API failed:', response.status);
      }
    } catch (error) {
      console.error('Error loading profile image:', error);
    }
  };

  const pickImage = async () => {
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

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showModal('Hata', 'Fotoğraf seçilirken bir hata oluştu.', 'error');
    }
  };

  const uploadImage = async (imageUri: string) => {
    try {
      setIsUploading(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        showModal('Hata', 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.', 'error');
        return;
      }

      // Create form data
      const formData = new FormData();
      formData.append('photo', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      } as any);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/customer/profile/photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const data = await response.json();
      console.log('Upload response status:', response.status);
      console.log('Upload response data:', data);

      if (response.ok && data.success) {
        console.log('Upload successful, reloading profile image...');
        // Reload profile image to ensure it's displayed
        await loadProfileImage();
        showModal('Başarılı', 'Profil fotoğrafınız başarıyla güncellendi.', 'success');
      } else {
        console.log('Upload failed:', data.error);
        showModal('Hata', data.error || 'Fotoğraf yüklenirken bir hata oluştu.', 'error');
      }
    } catch (error) {
        console.error('Error uploading image:', error);
        showModal('Hata', 'Fotoğraf yüklenirken bir hata oluştu.', 'error');
      } finally {
      setIsUploading(false);
    }
  };

  const removeProfileImage = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        showModal('Hata', 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.', 'error');
        return;
      }

      Alert.alert(
        'Profil Fotoğrafını Sil',
        'Profil fotoğrafınızı silmek istediğinizden emin misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: async () => {
              const response = await fetch(`${API_CONFIG.BASE_URL}/api/customer/profile/photo`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              const data = await response.json();

              if (response.ok && data.success) {
                setProfileImage(null);
                showModal('Başarılı', 'Profil fotoğrafınız başarıyla silindi.', 'success');
              } else {
                showModal('Hata', data.error || 'Fotoğraf silinirken bir hata oluştu.', 'error');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error removing image:', error);
      showModal('Hata', 'Fotoğraf silinirken bir hata oluştu.', 'error');
    }
  };



  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hesap Detayları</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity 
            style={styles.profileImageContainer}
            onPress={pickImage}
            disabled={isUploading}
          >
            {profileImage ? (
              <Image 
                source={{ uri: profileImage }} 
                style={styles.profileImagePhoto}
                onLoad={() => {
                  console.log('✅ Image loaded successfully!');
                  console.log('✅ Loaded image URL:', profileImage);
                }}
                onError={(error) => {
                  console.log('❌ Image load error:', error.nativeEvent.error);
                  console.log('❌ Failed image URL:', profileImage);
                  console.log('❌ Full error object:', error.nativeEvent);
                  setProfileImage(null);
                }}
                onLoadStart={() => {
                  console.log('🔄 Image load started for URL:', profileImage);
                }}
              />
            ) : (
              <View style={styles.profileImage}>
                <Ionicons name="person" size={48} color="#FCD34D" />
              </View>
            )}
            {isUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          
          {profileImage && (
            <TouchableOpacity 
              style={styles.removePhotoButton}
              onPress={removeProfileImage}
            >
              <Text style={styles.removePhotoText}>Fotoğrafı Kaldır</Text>
            </TouchableOpacity>
          )}
          
          <Text style={styles.userName}>{user?.full_name || 'Kullanıcı'}</Text>
        </View>

        {/* Account Information */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Hesap Bilgileri</Text>
          
          <View style={styles.infoItem}>
            <View style={styles.infoIcon}>
              <Ionicons name="call" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Telefon Numarası</Text>
              <Text style={styles.infoValue}>{user?.phone || 'Belirtilmemiş'}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoIcon}>
              <Ionicons name="mail" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>E-posta</Text>
              <Text style={styles.infoValue}>{user?.email || 'Belirtilmemiş'}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoIcon}>
              <Ionicons name="person-circle" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Kullanıcı ID</Text>
              <Text style={styles.infoValue}>{user?.id || 'Belirtilmemiş'}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoIcon}>
              <Ionicons name="shield-checkmark" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Doğrulama Durumu</Text>
              <View style={styles.verificationStatus}>
                <Text style={[styles.infoValue, { color: user?.is_verified ? '#10B981' : '#EF4444' }]}>
                  {user?.is_verified ? 'Doğrulanmış' : 'Doğrulanmamış'}
                </Text>
                <Ionicons 
                  name={user?.is_verified ? 'checkmark-circle' : 'close-circle'} 
                  size={16} 
                  color={user?.is_verified ? '#10B981' : '#EF4444'} 
                  style={styles.verificationIcon}
                />
              </View>
            </View>
          </View>

          {user?.wallet_balance !== undefined && (
            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Ionicons name="wallet" size={20} color="#6B7280" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Cüzdan Bakiyesi</Text>
                <Text style={styles.infoValue}>{user.wallet_balance.toFixed(2)} ₺</Text>
              </View>
            </View>
          )}
        </View>

        {/* Account Statistics */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Hesap İstatistikleri</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <View style={styles.statIcon}>
                <Ionicons name="time" size={24} color="#FFD700" />
              </View>
              <Text style={styles.statValue}>-</Text>
              <Text style={styles.statLabel}>Toplam Sipariş</Text>
            </View>
            
            <View style={styles.statItem}>
              <View style={styles.statIcon}>
                <Ionicons name="star" size={24} color="#FFD700" />
              </View>
              <Text style={styles.statValue}>-</Text>
              <Text style={styles.statLabel}>Ortalama Puan</Text>
            </View>
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={() => {
              showModal(
                'Çıkış Yap',
                'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?',
                'warning',
                [
                  {
                    text: 'İptal',
                    style: 'cancel',
                    onPress: () => {}
                  },
                  {
                    text: 'Çıkış Yap',
                    style: 'destructive',
                    onPress: async () => {
                      await logout();
                      router.replace('/splash');
                    }
                  }
                ]
              );
            }}
          >
            <Ionicons name="log-out" size={20} color="#EF4444" />
            <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImagePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FCD34D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoButton: {
    marginTop: 8,
    marginBottom: 8,
  },
  removePhotoText: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },

  infoSection: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  verificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationIcon: {
    marginLeft: 8,
  },
  statsSection: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  actionsSection: {
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 12,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutButtonText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600',
    marginLeft: 8,
  },
});