import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';


const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);
  const { isLoading, user, token } = useAuth();

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

    // İzinleri kontrol et
    checkPermissionsAndNavigate();
  }, []);

  // AuthContext loading tamamlandığında kullanıcı durumuna göre yönlendir
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        if (user && token) {
          // Kullanıcı giriş yapmış
          if (user.user_type === 'driver') {
            router.replace('/driver-dashboard');
          } else {
            // Bu driver app, müşteri buraya gelmemeli
            router.replace('/phone-auth');
          }
        } else {
          // Kullanıcı giriş yapmamış
          router.replace('/phone-auth');
        }
      }, 3000); // 3 saniye splash screen göster

      return () => clearTimeout(timer);
    }
  }, [isLoading, user, token]);

  const checkPermissionsAndNavigate = async () => {
    try {
      // Konum izni iste
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      
      console.log('İzinler kontrol edildi:', { locationStatus });
      
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
        <Image 
          source={require('../assets/images/logo_animation.gif')}
          style={styles.logo}
          resizeMode="contain"
        />
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
  logo: {
    width: 200,
    height: 200,
    marginBottom: 24,
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