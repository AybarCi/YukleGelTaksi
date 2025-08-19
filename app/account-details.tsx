import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function AccountDetailsScreen() {
  const { user } = useAuth();

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Belirtilmemiş';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getUserType = (type: string) => {
    switch (type) {
      case 'passenger':
        return 'Müşteri';
      case 'driver':
        return 'Sürücü';
      default:
        return 'Belirtilmemiş';
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
          <View style={styles.profileImage}>
            <Ionicons name="person" size={48} color="#FCD34D" />
          </View>
          <Text style={styles.userName}>{user?.full_name || 'Kullanıcı'}</Text>
          <Text style={styles.userType}>{getUserType(user?.user_type || '')}</Text>
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
                <Ionicons name="time" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.statValue}>-</Text>
              <Text style={styles.statLabel}>Toplam Sipariş</Text>
            </View>
            
            <View style={styles.statItem}>
              <View style={styles.statIcon}>
                <Ionicons name="star" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.statValue}>-</Text>
              <Text style={styles.statLabel}>Ortalama Puan</Text>
            </View>
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="create" size={20} color="#F59E0B" />
            <Text style={styles.actionButtonText}>Profil Düzenle</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="lock-closed" size={20} color="#F59E0B" />
            <Text style={styles.actionButtonText}>Şifre Değiştir</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
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
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  userType: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
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
});