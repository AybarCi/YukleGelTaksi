import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const { user, logout, showModal } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [isAccountFrozen, setIsAccountFrozen] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('userSettings');
      if (settings) {
        const parsedSettings = JSON.parse(settings);
        setNotificationsEnabled(parsedSettings.notifications ?? true);
        setLocationEnabled(parsedSettings.location ?? true);
        setMarketingEnabled(parsedSettings.marketing ?? false);
        setSoundEnabled(parsedSettings.sound ?? true);
        setVibrationEnabled(parsedSettings.vibration ?? true);
        setIsAccountFrozen(parsedSettings.accountFrozen ?? false);
      }
    } catch (error) {
      console.error('Ayarlar yüklenirken hata:', error);
    }
  };

  const saveSettings = async (newSettings: any) => {
    try {
      const currentSettings = {
        notifications: notificationsEnabled,
        location: locationEnabled,
        marketing: marketingEnabled,
        sound: soundEnabled,
        vibration: vibrationEnabled,
        accountFrozen: isAccountFrozen,
        ...newSettings,
      };
      await AsyncStorage.setItem('userSettings', JSON.stringify(currentSettings));
    } catch (error) {
      console.error('Ayarlar kaydedilirken hata:', error);
    }
  };

  const handleNotificationToggle = (value: boolean) => {
    setNotificationsEnabled(value);
    saveSettings({ notifications: value });
    if (!value) {
      // Disable all notification types when main toggle is off
      setSoundEnabled(false);
      setVibrationEnabled(false);
      setMarketingEnabled(false);
      saveSettings({ 
        notifications: value, 
        sound: false, 
        vibration: false, 
        marketing: false 
      });
    }
  };

  const handleLocationToggle = (value: boolean) => {
    setLocationEnabled(value);
    saveSettings({ location: value });
    if (!value) {
      Alert.alert(
        'Konum İzni',
        'Konum izni kapatıldığında bazı özellikler düzgün çalışmayabilir.',
        [{ text: 'Tamam' }]
      );
    }
  };

  const handleMarketingToggle = (value: boolean) => {
    setMarketingEnabled(value);
    saveSettings({ marketing: value });
  };

  const handleSoundToggle = (value: boolean) => {
    if (notificationsEnabled) {
      setSoundEnabled(value);
      saveSettings({ sound: value });
    }
  };

  const handleVibrationToggle = (value: boolean) => {
    if (notificationsEnabled) {
      setVibrationEnabled(value);
      saveSettings({ vibration: value });
    }
  };

  const handleFreezeAccount = () => {
    Alert.alert(
      'Hesabı Dondur',
      isAccountFrozen 
        ? 'Hesabınızı aktif hale getirmek istediğinizden emin misiniz?'
        : 'Hesabınızı dondurmak istediğinizden emin misiniz? Bu işlem geri alınabilir.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: isAccountFrozen ? 'Aktifleştir' : 'Dondur',
          style: isAccountFrozen ? 'default' : 'destructive',
          onPress: () => {
            const newStatus = !isAccountFrozen;
            setIsAccountFrozen(newStatus);
            saveSettings({ accountFrozen: newStatus });
            showModal(
              'Başarılı',
              newStatus 
                ? 'Hesabınız donduruldu. Tekrar aktifleştirmek için bu sayfadan işlem yapabilirsiniz.'
                : 'Hesabınız aktifleştirildi.',
              'success'
            );
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Sil',
      'Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve tüm verileriniz silinecektir.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement account deletion API call
            showModal(
              'Bilgi',
              'Hesap silme işlemi için müşteri hizmetleri ile iletişime geçiniz.',
              'info'
            );
          },
        },
      ]
    );
  };

  const handleChangePassword = () => {
    // TODO: Navigate to change password screen
    showModal('Bilgi', 'Şifre değiştirme sayfası yakında eklenecek.', 'info');
  };

  const handlePrivacyPolicy = () => {
    // TODO: Navigate to privacy policy screen
    showModal('Bilgi', 'Gizlilik politikası sayfası yakında eklenecek.', 'info');
  };

  const handleTermsOfService = () => {
    // TODO: Navigate to terms of service screen
    showModal('Bilgi', 'Kullanım şartları sayfası yakında eklenecek.', 'info');
  };

  const handleContactSupport = () => {
    // TODO: Navigate to support screen
    showModal('Bilgi', 'Destek sayfası yakında eklenecek.', 'info');
  };

  const renderSettingItem = (
    title: string,
    subtitle: string,
    icon: string,
    value?: boolean,
    onToggle?: (value: boolean) => void,
    onPress?: () => void,
    disabled?: boolean,
    iconLibrary: 'Ionicons' | 'MaterialIcons' = 'Ionicons'
  ) => {
    const IconComponent = iconLibrary === 'Ionicons' ? Ionicons : MaterialIcons;
    
    return (
      <TouchableOpacity 
        style={[styles.settingItem, disabled && styles.disabledItem]} 
        onPress={onPress}
        disabled={disabled && !onToggle}
      >
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, disabled && styles.disabledIcon]}>
            <IconComponent name={icon as any} size={20} color={disabled ? '#9CA3AF' : '#F59E0B'} />
          </View>
          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, disabled && styles.disabledText]}>{title}</Text>
            <Text style={[styles.settingSubtitle, disabled && styles.disabledText]}>{subtitle}</Text>
          </View>
        </View>
        {onToggle ? (
          <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{ false: '#E5E7EB', true: '#FED7AA' }}
            thumbColor={value ? '#F59E0B' : '#9CA3AF'}
            disabled={disabled}
          />
        ) : (
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        )}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (title: string) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

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
        <Text style={styles.headerTitle}>Ayarlar</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account Status */}
        {isAccountFrozen && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={20} color="#EF4444" />
            <Text style={styles.warningText}>Hesabınız dondurulmuş durumda</Text>
          </View>
        )}

        {/* Notification Settings */}
        {renderSectionHeader('Bildirim Ayarları')}
        {renderSettingItem(
          'Bildirimler',
          'Uygulama bildirimlerini al',
          'notifications',
          notificationsEnabled,
          handleNotificationToggle
        )}
        {renderSettingItem(
          'Ses',
          'Bildirim sesleri',
          'volume-high',
          soundEnabled,
          handleSoundToggle,
          undefined,
          !notificationsEnabled
        )}
        {renderSettingItem(
          'Titreşim',
          'Bildirim titreşimleri',
          'phone-vibrate',
          vibrationEnabled,
          handleVibrationToggle,
          undefined,
          !notificationsEnabled,
          'MaterialIcons'
        )}
        {renderSettingItem(
          'Pazarlama',
          'Kampanya ve promosyon bildirimleri',
          'megaphone',
          marketingEnabled,
          handleMarketingToggle,
          undefined,
          !notificationsEnabled
        )}

        {/* Privacy Settings */}
        {renderSectionHeader('Gizlilik Ayarları')}
        {renderSettingItem(
          'Konum İzni',
          'Konum bilgilerini paylaş',
          'location',
          locationEnabled,
          handleLocationToggle
        )}

        {/* Account Settings */}
        {renderSectionHeader('Hesap Ayarları')}
        {renderSettingItem(
          'Şifre Değiştir',
          'Hesap şifrenizi güncelleyin',
          'key',
          undefined,
          undefined,
          handleChangePassword
        )}
        {renderSettingItem(
          isAccountFrozen ? 'Hesabı Aktifleştir' : 'Hesabı Dondur',
          isAccountFrozen ? 'Hesabınızı tekrar aktif hale getirin' : 'Hesabınızı geçici olarak dondurun',
          isAccountFrozen ? 'play-circle' : 'pause-circle',
          undefined,
          undefined,
          handleFreezeAccount
        )}
        {renderSettingItem(
          'Hesabı Sil',
          'Hesabınızı kalıcı olarak silin',
          'trash',
          undefined,
          undefined,
          handleDeleteAccount
        )}

        {/* Legal */}
        {renderSectionHeader('Yasal')}
        {renderSettingItem(
          'Gizlilik Politikası',
          'Gizlilik politikamızı inceleyin',
          'shield-checkmark',
          undefined,
          undefined,
          handlePrivacyPolicy
        )}
        {renderSettingItem(
          'Kullanım Şartları',
          'Hizmet şartlarımızı okuyun',
          'document-text',
          undefined,
          undefined,
          handleTermsOfService
        )}

        {/* Support */}
        {renderSectionHeader('Destek')}
        {renderSettingItem(
          'Müşteri Hizmetleri',
          'Yardım ve destek alın',
          'help-circle',
          undefined,
          undefined,
          handleContactSupport
        )}

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>YükleGel Taksi v1.0.0</Text>
          <Text style={styles.appInfoSubtext}>© 2024 YükleGel Taksi</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    marginBottom: 20,
  },
  warningText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
    marginLeft: 8,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  disabledItem: {
    opacity: 0.5,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  disabledIcon: {
    backgroundColor: '#F3F4F6',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  disabledText: {
    color: '#9CA3AF',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  appInfoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  appInfoSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});