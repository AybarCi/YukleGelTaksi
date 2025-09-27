import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MenuItem {
  title: string;
  icon: string;
  iconType: 'Ionicons' | 'MaterialIcons';
  onPress: () => void;
}

interface User {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
}

interface CustomerMenuProps {
  user: User | null;
  menuItems: MenuItem[];
  bottomMenuItems: MenuItem[];
  onAccountPress: () => void;
}

const CustomerMenu: React.FC<CustomerMenuProps> = ({
  user,
  menuItems,
  bottomMenuItems,
  onAccountPress,
}) => {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  const maxScrollHeight = screenHeight * 0.5;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#000000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Menü</Text>
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
                  color: '#FFFFFF',
                  fontSize: 18,
                  fontWeight: 'bold'
                }}>
                  {user?.full_name?.charAt(0) || 'U'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#1F2937'
                }}>
                  {user?.full_name || 'Kullanıcı'}
                </Text>
                <TouchableOpacity 
                  style={{
                    marginTop: 4,
                    alignSelf: 'flex-start'
                  }}
                  onPress={onAccountPress}
                >
                  <Text style={{
                    fontSize: 14,
                    color: '#FFD700',
                    fontWeight: '500',
                    textDecorationLine: 'underline'
                  }}>
                    Hesabım
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <ScrollView style={{ maxHeight: maxScrollHeight }}>
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
                {item.iconType === 'Ionicons' ? (
                  <Ionicons name={item.icon as any} size={24} color="#6B7280" />
                ) : (
                  <MaterialIcons name={item.icon as any} size={24} color="#6B7280" />
                )}
                <Text style={{
                  marginLeft: 16,
                  fontSize: 16,
                  color: '#1F2937'
                }}>
                  {item.title}
                </Text>
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
                {item.iconType === 'Ionicons' ? (
                  <Ionicons name={item.icon as any} size={24} color="#6B7280" />
                ) : (
                  <MaterialIcons name={item.icon as any} size={24} color="#6B7280" />
                )}
                <Text style={{
                  marginLeft: 16,
                  fontSize: 16,
                  color: '#1F2937'
                }}>
                  {item.title}
                </Text>
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

export default CustomerMenu;