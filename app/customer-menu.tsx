import React from 'react';
import { router } from 'expo-router';
import CustomerMenu from '../components/CustomerMenu';
import { useAuth } from '../contexts/AuthContext';

const CustomerMenuScreen = () => {
  const { user, logout, showModal } = useAuth();

  const menuItems = [
    {
      title: 'Destek',
      icon: 'headset',
      iconType: 'Ionicons' as const,
      onPress: () => {
        router.push('/customer-support');
      }
    },
    {
      title: 'Ödeme',
      icon: 'credit-card',
      iconType: 'MaterialIcons' as const,
      onPress: () => {
        showModal('Ödeme', 'Ödeme sayfası yakında eklenecek.', 'info');
      }
    },
    {
      title: 'Taşımalarım',
      icon: 'local-shipping',
      iconType: 'MaterialIcons' as const,
      onPress: () => {
        router.push('/shipments');
      },
    },
  ];

  const bottomMenuItems = [
    {
      title: 'YükleGel Taksi Kampanyalar',
      icon: 'card-giftcard',
      iconType: 'MaterialIcons' as const,
      onPress: () => {
        showModal('Kampanyalar', 'Kampanyalar sayfası yakında eklenecek.', 'info');
      }
    },
    {
      title: 'Kampanyalar',
      icon: 'card-giftcard',
      iconType: 'MaterialIcons' as const,
      onPress: () => {
        showModal('Kampanyalar', 'Kampanyalar sayfası yakında eklenecek.', 'info');
      }
    },
    {
      title: 'Aracımı Paylaşmak İstiyorum',
      icon: 'car',
      iconType: 'Ionicons' as const,
      onPress: () => {
        showModal('Araç Paylaşımı', 'Araç paylaşımı sayfası yakında eklenecek.', 'info');
      }
    },
    {
      title: 'Ayarlar',
      icon: 'settings',
      iconType: 'Ionicons' as const,
      onPress: () => {
        router.push('/settings');
      }
    },
  ];

  const handleAccountPress = () => {
    router.push('/account-details');
  };

  return (
    <CustomerMenu
      user={user}
      menuItems={menuItems}
      bottomMenuItems={bottomMenuItems}
      onAccountPress={handleAccountPress}
    />
  );
};

export default CustomerMenuScreen;