import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface ToggleButtonProps {
  isOn: boolean;
  onToggle: () => void;
  onText?: string;
  offText?: string;
  onColors?: string[];
  offColors?: string[];
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  isOn,
  onToggle,
  onText = 'ÇEVRİMİÇİ',
  offText = 'ÇEVRİMDIŞI',
  onColors = ['#10B981', '#059669'],
  offColors = ['#EF4444', '#DC2626'],
  disabled = false,
  size = 'medium'
}) => {
  const slideAnimation = useRef(new Animated.Value(isOn ? 1 : 0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const glowAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnimation, {
        toValue: isOn ? 1 : 0,
        useNativeDriver: false,
        tension: 120,
        friction: 7,
      }),
      Animated.timing(glowAnimation, {
        toValue: isOn ? 1 : 0,
        duration: 400,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isOn]);

  const handlePress = () => {
    if (disabled) return;
    
    // Basma animasyonu
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
    ]).start();

    onToggle();
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: { width: 70, height: 35 },
          circle: { width: 27, height: 27 },
          text: { fontSize: 8 },
          icon: 12,
        };
      case 'large':
        return {
          container: { width: 110, height: 55 },
          circle: { width: 47, height: 47 },
          text: { fontSize: 12 },
          icon: 20,
        };
      default: // medium
        return {
          container: { width: 90, height: 45 },
          circle: { width: 37, height: 37 },
          text: { fontSize: 10 },
          icon: 16,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  const slideTranslate = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [4, sizeStyles.container.width - sizeStyles.circle.width - 4],
  });

  const textOpacity = slideAnimation.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [1, 0.3, 0.3, 1],
  });

  const glowOpacity = glowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  const currentColors = isOn ? onColors : offColors;

  return (
    <Animated.View
      style={[
        styles.container,
        sizeStyles.container,
        {
          transform: [{ scale: scaleAnimation }],
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      {/* Glow efekti */}
      <Animated.View
        style={[
          styles.glowContainer,
          sizeStyles.container,
          {
            opacity: glowOpacity,
          },
        ]}
      >
        <LinearGradient
          colors={[currentColors[0], currentColors[1], currentColors[0]] as const}
          style={[styles.glow, sizeStyles.container]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Ana toggle container */}
      <LinearGradient
        colors={[currentColors[0], currentColors[1]]}
        style={[styles.gradientContainer, sizeStyles.container]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity
          style={[styles.touchable, sizeStyles.container]}
          onPress={handlePress}
          disabled={disabled}
          activeOpacity={0.8}
        >
          {/* Arka plan metni - Gizlendi */}
          {/* <View style={styles.backgroundTextContainer}>
            <Animated.Text
              style={[
                styles.backgroundText,
                sizeStyles.text,
                {
                  opacity: textOpacity,
                  color: '#FFFFFF',
                },
              ]}
            >
              {isOn ? onText : offText}
            </Animated.Text>
          </View> */}

          {/* Kaydırılabilir daire */}
          <Animated.View
            style={[
              styles.circle,
              sizeStyles.circle,
              {
                transform: [{ translateX: slideTranslate }],
              },
            ]}
          >
            <LinearGradient
              colors={['#FFFFFF', '#F8FAFC']}
              style={[styles.circleGradient, sizeStyles.circle]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.circleInner}>
                <Ionicons
                  name={isOn ? 'wifi' : 'wifi-outline'}
                  size={sizeStyles.icon}
                  color={isOn ? onColors[0] : offColors[0]}
                />
              </View>
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 25,
    position: 'relative',
  },
  glowContainer: {
    position: 'absolute',
    borderRadius: 25,
    transform: [{ scale: 1.1 }],
  },
  glow: {
    borderRadius: 25,
    opacity: 0.3,
  },
  gradientContainer: {
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  touchable: {
    borderRadius: 25,
    justifyContent: 'center',
    position: 'relative',
  },
  backgroundTextContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundText: {
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  circle: {
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  circleGradient: {
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ToggleButton;