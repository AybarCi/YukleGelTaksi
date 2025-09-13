import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';
import DriverMenu from '../components/DriverMenu';

const DriverMenuScreen = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const menuItems = [
    {
      title: 'Sürücü Bilgileri',
      subtitle: 'Profil bilgilerinizi görüntüleyin ve düzenleyin',
      icon: 'person-outline',
      onPress: () => router.push('/driver-profile'),
    },
    {
      title: 'Sipariş Geçmişi',
      subtitle: 'Tamamladığınız siparişleri görüntüleyin',
      icon: 'time-outline',
      onPress: () => router.push('/driver-order-history'),
    },
    {
      title: 'Kazançlarım',
      subtitle: 'Günlük ve aylık kazançlarınızı görüntüleyin',
      icon: 'wallet-outline',
      onPress: () => router.push('/driver-earnings'),
    },
    {
      title: 'Değerlendirmeler',
      subtitle: 'Müşteri değerlendirmelerinizi görüntüleyin',
      icon: 'star-outline',
      onPress: () => router.push('/driver-reviews'),
    },
    {
      title: 'Destek Taleplerim',
      subtitle: 'Destek taleplerini takip edin ve yanıtları görün',
      icon: 'chatbubbles-outline',
      onPress: () => router.push('/driver-support-tickets'),
    },
    {
      title: 'Ayarlar',
      subtitle: 'Uygulama ayarlarını düzenleyin',
      icon: 'settings-outline',
      onPress: () => router.push('/driver-settings'),
    },
    {
      title: 'Yardım ve Destek',
      subtitle: 'SSS ve destek talebi oluşturun',
      icon: 'help-circle-outline',
      onPress: () => router.push('/driver-support'),
    },
  ];

  const bottomMenuItems: Array<{
    title: string;
    subtitle: string;
    icon: string;
    color?: string;
    onPress: () => void;
  }> = [];

  const handleProfilePress = () => {
    router.push('/driver-profile');
  };

  return (
    <DriverMenu
      driver={user}
      menuItems={menuItems}
      bottomMenuItems={bottomMenuItems}
      onProfilePress={handleProfilePress}
    />
  );
};

export default DriverMenuScreen;