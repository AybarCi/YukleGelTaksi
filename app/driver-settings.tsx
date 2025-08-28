import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';

interface DriverSettings {
  notifications_enabled: boolean;
  location_sharing: boolean;
  auto_accept_orders: boolean;
  working_hours_start: string;
  working_hours_end: string;
  max_distance_km: number;
  language: string;
  sound_enabled: boolean;
  vibration_enabled: boolean;
}

export default function DriverSettingsScreen() {
  const [settings, setSettings] = useState<DriverSettings>({
    notifications_enabled: true,
    location_sharing: true,
    auto_accept_orders: false,
    working_hours_start: '08:00',
    working_hours_end: '22:00',
    max_distance_km: 10,
    language: 'tr',
    sound_enabled: true,
    vibration_enabled: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Hata', 'Oturum bilgisi bulunamadı');
        return;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/driver/settings`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Settings load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof DriverSettings, value: any) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Hata', 'Oturum bilgisi bulunamadı');
        return;
      }

      const updatedSettings = { ...settings, [key]: value };
      setSettings(updatedSettings);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/driver/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        // Revert on error
        setSettings(settings);
        Alert.alert('Hata', 'Ayar güncellenemedi');
      }
    } catch (error) {
      console.error('Settings update error:', error);
      setSettings(settings);
      Alert.alert('Hata', 'Bir hata oluştu');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('auth_token');
            await AsyncStorage.removeItem('userType');
            router.replace('/splash');
          },
        },
      ]
    );
  };

  const handlePrivacyPolicy = () => {
    router.push('/privacy-policy');
  };

  const handleTermsOfService = () => {
    router.push('/terms-of-service');
  };

  const openSupport = () => {
    Linking.openURL('mailto:support@yuklegelTaksi.com');
  };

  const renderSettingItem = (
    title: string,
    subtitle: string,
    icon: string,
    value: boolean,
    onToggle: (value: boolean) => void
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <Ionicons name={icon as any} size={24} color="#10B981" />
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#D1D5DB', true: '#10B981' }}
        thumbColor={value ? '#FFFFFF' : '#FFFFFF'}
      />
    </View>
  );

  const renderActionItem = (
    title: string,
    subtitle: string,
    icon: string,
    onPress: () => void,
    color: string = '#10B981'
  ) => (
    <TouchableOpacity style={styles.actionItem} onPress={onPress}>
      <View style={styles.settingInfo}>
        <Ionicons name={icon as any} size={24} color={color} />
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color }]}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ayarlar</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bildirimler</Text>
          {renderSettingItem(
            'Bildirimler',
            'Yeni sipariş ve mesaj bildirimleri',
            'notifications',
            settings.notifications_enabled,
            (value) => updateSetting('notifications_enabled', value)
          )}
          {renderSettingItem(
            'Ses',
            'Bildirim sesleri',
            'volume-high',
            settings.sound_enabled,
            (value) => updateSetting('sound_enabled', value)
          )}
          {renderSettingItem(
            'Titreşim',
            'Bildirim titreşimleri',
            'phone-portrait',
            settings.vibration_enabled,
            (value) => updateSetting('vibration_enabled', value)
          )}
        </View>

        {/* Work Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Çalışma Ayarları</Text>
          {renderSettingItem(
            'Konum Paylaşımı',
            'Müşterilerle konum paylaşımı',
            'location',
            settings.location_sharing,
            (value) => updateSetting('location_sharing', value)
          )}
          {renderSettingItem(
            'Otomatik Kabul',
            'Siparişleri otomatik kabul et',
            'checkmark-circle',
            settings.auto_accept_orders,
            (value) => updateSetting('auto_accept_orders', value)
          )}
        </View>

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesap</Text>
          {renderActionItem(
            'Profil Bilgileri',
            'Kişisel ve araç bilgilerinizi düzenleyin',
            'person',
            () => router.push('/driver-profile')
          )}
          {renderActionItem(
            'Şifre Değiştir',
            'Hesap şifrenizi güncelleyin',
            'key',
            () => {}
          )}
        </View>

        {/* Support & Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Destek ve Yasal</Text>
          {renderActionItem(
            'Yardım ve Destek',
            'Sorularınız için bizimle iletişime geçin',
            'help-circle',
            openSupport
          )}
          {renderActionItem(
            'Gizlilik Politikası',
            'Gizlilik politikamızı inceleyin',
            'shield-checkmark',
            handlePrivacyPolicy
          )}
          {renderActionItem(
            'Kullanım Şartları',
            'Hizmet şartlarımızı okuyun',
            'document-text',
            handleTermsOfService
          )}
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uygulama</Text>
          <View style={styles.infoItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="information-circle" size={24} color="#6B7280" />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Sürüm</Text>
                <Text style={styles.settingSubtitle}>1.0.0</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={24} color="#EF4444" />
            <Text style={styles.logoutText}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 12,
    marginHorizontal: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 16,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
});