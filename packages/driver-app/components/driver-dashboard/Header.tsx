import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DriverInfo } from '../../types/dashboard';

interface HeaderProps {
  driverInfo: DriverInfo | null;
  isOnline: boolean;
  onToggleOnlineStatus: () => void;
  onOpenMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  driverInfo,
  isOnline,
  onToggleOnlineStatus,
  onOpenMenu,
}) => {
  const handleToggleOnlineStatus = () => {
    if (!driverInfo) {
      Alert.alert('Hata', 'Sürücü bilgileri yüklenemedi');
      return;
    }
    onToggleOnlineStatus();
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onOpenMenu} style={styles.menuButton}>
        <Ionicons name="menu" size={24} color="#fff" />
      </TouchableOpacity>
      
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>Sürücü Paneli</Text>
        {driverInfo && (
          <Text style={styles.driverName}>{driverInfo.name}</Text>
        )}
      </View>
      
      <TouchableOpacity 
        onPress={handleToggleOnlineStatus}
        style={[
          styles.statusButton,
          { backgroundColor: isOnline ? '#4CAF50' : '#f44336' }
        ]}
      >
        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot,
            { backgroundColor: isOnline ? '#fff' : '#fff' }
          ]} />
          <Text style={styles.statusText}>
            {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  menuButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  driverName: {
    fontSize: 14,
    color: '#E3F2FD',
    marginTop: 2,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 90,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});