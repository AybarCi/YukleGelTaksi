import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import LoadingIndicator from '../components/LoadingIndicator';

interface DriverStatus {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  status: string;
}

export default function DriverStatusScreen() {
  const { showModal, logout } = useAuth();
  const [driverStatus, setDriverStatus] = useState<DriverStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  useEffect(() => {
    loadDriverStatus();
  }, []);

  const loadDriverStatus = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      }
      
      // Token'ı AsyncStorage'dan al
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/phone-auth');
        return;
      }
      
      // Sürücü durumunu API'den çek
      const response = await fetch(`http://192.168.1.12:3001/api/drivers/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Driver status response:', result);
        
        // API response'ının yapısına göre kontrol et
        if (result.exists === false) {
          // Sürücü kaydı bulunamadı, kayıt ekranına yönlendir
          router.replace('/driver-registration');
          return;
        }
        
        // API response'ının yapısına göre data'yı al
        const driverData = result.data || result;
        setDriverStatus(driverData);
        if (isRefresh) {
          showModal('Başarılı', 'Durum bilgisi güncellendi.', 'success');
        }
      } else if (response.status === 404) {
        // Sürücü kaydı bulunamadı, kayıt ekranına yönlendir
        router.replace('/driver-registration');
        return;
      } else {
        showModal('Hata', 'Durum bilgisi alınırken bir hata oluştu.', 'error');
      }
    } catch (error) {
      console.log('Error checking driver status:', error);
      // Network error - logout user and redirect to login
      await logout();
      router.replace('/phone-auth');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleContinueAsDriver = () => {
    if (driverStatus?.is_approved && driverStatus?.is_active) {
      router.replace('/driver-dashboard');
    } else {
      showModal('Bilgi', 'Hesabınız henüz onaylanmamış.', 'info');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/phone-auth');
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LoadingIndicator 
          visible={true} 
          text="Durum kontrol ediliyor..." 
        />
      </View>
    );
  }

  if (!driverStatus) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Bir hata oluştu</Text>
        <Text style={styles.errorText}>Durum bilgisi alınamadı</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadDriverStatus()}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getStatusInfo = () => {
    if (driverStatus.is_approved && driverStatus.is_active) {
      return {
        icon: 'checkmark-circle',
        color: '#10B981',
        title: 'Başvurunuz Onaylandı!',
        description: 'Artık sürücü olarak çalışmaya başlayabilirsiniz.',
        actionText: 'Sürücü Paneline Git',
        canContinue: true,
      };
    } else if (driverStatus.is_approved && !driverStatus.is_active) {
      return {
        icon: 'pause-circle',
        color: '#F59E0B',
        title: 'Hesabınız Askıda',
        description: 'Hesabınız geçici olarak askıya alınmış. Destek ile iletişime geçin.',
        actionText: 'Destek ile İletişim',
        canContinue: false,
      };
    } else {
      return {
        icon: 'time',
        color: '#F59E0B',
        title: 'Başvurunuz İnceleniyor',
        description: 'Başvurunuz yönetici tarafından inceleniyor. Lütfen bekleyin.',
        actionText: 'Durumu Yenile',
        canContinue: false,
      };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={24} color="#EF4444" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sürücü Durumu</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={[styles.statusCard, { borderColor: statusInfo.color }]}>
          <View style={[styles.iconContainer, { backgroundColor: `${statusInfo.color}20` }]}>
            <Ionicons name={statusInfo.icon as any} size={48} color={statusInfo.color} />
          </View>
          
          <Text style={styles.statusTitle}>{statusInfo.title}</Text>
          <Text style={styles.statusDescription}>{statusInfo.description}</Text>
          
          <View style={styles.driverInfo}>
            <Text style={styles.applicationNumber}>
              Başvuru No: #{driverStatus.id.toString().padStart(6, '0')}
            </Text>
            <Text style={styles.driverName}>
              {driverStatus.first_name} {driverStatus.last_name}
            </Text>
            <Text style={styles.driverPhone}>{driverStatus.phone}</Text>
            <Text style={styles.applicationDate}>
              Başvuru Tarihi: {new Date(driverStatus.created_at).toLocaleDateString('tr-TR')}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[
            styles.actionButton,
            { backgroundColor: statusInfo.canContinue ? '#10B981' : statusInfo.color },
            isRefreshing && !statusInfo.canContinue && styles.disabledButton
          ]}
          onPress={() => {
            if (statusInfo.canContinue) {
              handleContinueAsDriver();
            } else {
              loadDriverStatus(true);
            }
          }}
          disabled={isRefreshing && !statusInfo.canContinue}
        >
          {isRefreshing && !statusInfo.canContinue ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator size="small" color="#FFFFFF" style={styles.buttonLoader} />
              <Text style={styles.actionButtonText}>Yenileniyor...</Text>
            </View>
          ) : (
            <Text style={styles.actionButtonText}>{statusInfo.actionText}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
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
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
  },
  statusDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  driverInfo: {
    alignItems: 'center',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    width: '100%',
  },
  applicationNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FCD34D',
    marginBottom: 12,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  driverPhone: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  applicationDate: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#FCD34D',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLoader: {
    marginRight: 8,
  },
});