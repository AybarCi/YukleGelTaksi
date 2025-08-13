import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';


const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    // Logo animasyonu
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // İzinleri kontrol et ve sonraki ekrana geç
    checkPermissionsAndNavigate();
  }, []);

  // 3 saniye sonra telefon auth ekranına geç
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/phone-auth');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const checkPermissionsAndNavigate = async () => {
    try {
      // Konum izni iste
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      
      // Bildirim izni iste
      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
      
      console.log('İzinler kontrol edildi:', { locationStatus, notificationStatus });
      
    } catch (error) {
      console.error('İzin hatası:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <Animated.View 
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <View style={styles.logoCircle}>
          <Ionicons name="car" size={60} color="#000000" />
        </View>
        
        <Text style={styles.appName}>YükleGel</Text>
        <Text style={styles.appSubtitle}>Taksi</Text>
      </Animated.View>
      
      <View style={styles.footer}>
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 100,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FCD34D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 8,
    shadowColor: '#FCD34D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
});