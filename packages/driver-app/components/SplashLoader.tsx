import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  Modal,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface SplashLoaderProps {
  visible: boolean;
  text?: string;
  showLogo?: boolean;
  backgroundColor?: string;
  textColor?: string;
  logoSize?: number;
  duration?: number;
  onAnimationComplete?: () => void;
}

export default function SplashLoader({
  visible,
  text = 'Yükleniyor...',
  showLogo = true,
  backgroundColor = '#FFFFFF',
  textColor = '#6B7280',
  logoSize = 200,
  duration = 1000,
  onAnimationComplete
}: SplashLoaderProps) {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    if (visible) {
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);

      // Start animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      });
    }
  }, [visible, duration, onAnimationComplete]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
    >
      <View style={[styles.container, { backgroundColor }]}>
        {showLogo && (
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
              style={[styles.logo, { width: logoSize, height: logoSize }]}
              resizeMode="contain"
            />
          </Animated.View>
        )}
        
        <View style={styles.footer}>
          <Text style={[styles.loadingText, { color: textColor }]}>{text}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 100,
  },
  logo: {
    marginBottom: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
});