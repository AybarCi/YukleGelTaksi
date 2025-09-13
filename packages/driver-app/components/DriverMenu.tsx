import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MenuItem {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
  color?: string;
}

interface Driver {
  full_name?: string;
  email?: string;
}

interface DriverMenuProps {
  driver: Driver | null;
  menuItems: MenuItem[];
  bottomMenuItems: MenuItem[];
  onProfilePress: () => void;
}

const DriverMenu: React.FC<DriverMenuProps> = ({
  driver,
  menuItems,
  bottomMenuItems,
  onProfilePress,
}) => {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  
  // Calculate available height for ScrollView
  const headerHeight = 60;
  const userInfoHeight = 100;
  const bottomPadding = 20;
  const availableHeight = screenHeight - insets.top - insets.bottom - headerHeight - userInfoHeight - bottomPadding;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sürücü Menüsü</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={{ marginBottom: 20, marginTop: 30 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16
          }}>
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: '#FFD700',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12
            }}>
              <Text style={{
                color: '#000000',
                fontSize: 18,
                fontWeight: 'bold'
              }}>
                {driver?.full_name?.charAt(0) || 'S'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#1F2937'
              }}>
                {driver?.full_name || 'Sürücü'}
              </Text>
              <TouchableOpacity 
                style={{
                  marginTop: 4,
                  alignSelf: 'flex-start'
                }}
                onPress={onProfilePress}
              >
                <Text style={{
                  fontSize: 14,
                  color: '#FFD700',
                  fontWeight: '500',
                  textDecorationLine: 'underline'
                }}>
                  Profilim
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView 
          style={{ 
            flex: 1,
            maxHeight: Math.max(availableHeight, 300) // Minimum 300px height
          }}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ 
            paddingBottom: 20,
            minHeight: availableHeight > 400 ? availableHeight * 0.8 : 300
          }}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#F3F4F6'
              }}
              onPress={item.onPress}
            >
              <Ionicons name={item.icon as any} size={24} color={item.color || "#6B7280"} />
              <View style={{
                marginLeft: 16,
                flex: 1
              }}>
                <Text style={{
                  fontSize: 16,
                  color: item.color || '#1F2937',
                  fontWeight: '500'
                }}>
                  {item.title}
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: '#6B7280',
                  marginTop: 2
                }}>
                  {item.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}

          <View style={{ height: 20 }} />

          {bottomMenuItems.map((item, index) => (
            <TouchableOpacity
              key={`bottom-${index}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderBottomWidth: index < bottomMenuItems.length - 1 ? 1 : 0,
                borderBottomColor: '#F3F4F6'
              }}
              onPress={item.onPress}
            >
              <Ionicons
                name={item.icon as any}
                size={24}
                color={item.color || '#6B7280'}
              />
              <View style={{
                marginLeft: 16,
                flex: 1
              }}>
                <Text style={{
                  fontSize: 16,
                  color: item.color || '#1F2937',
                  fontWeight: '500'
                }}>
                  {item.title}
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: '#6B7280',
                  marginTop: 2
                }}>
                  {item.subtitle}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
});

export default DriverMenu;