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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
          <View style={styles.profileImage}>
            {profile?.profile_image ? (
              <Image source={{ uri: profile.profile_image }} style={styles.profileImageImg} />
            ) : (
              <Ionicons name="person" size={60} color="#FFD700" />
            )}
          </View>
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
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileImageImg: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
});