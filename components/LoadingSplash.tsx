import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
} from 'react-native';

interface LoadingSplashProps {
  visible: boolean;
  message?: string;
}

const LoadingSplash: React.FC<LoadingSplashProps> = ({ 
  visible, 
  message = 'Harita yükleniyor...' 
}) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      setIsVisible(true);
      // Fade in animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();


    } else {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIsVisible(false);
      });
    }
  }, [visible, fadeAnim, scaleAnim]);



  if (!visible && !isVisible) {
    return null;
  }



  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        }
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.content}>
        <Animated.View 
          style={[
            styles.logoContainer,
            {
              transform: [
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          <Image 
            source={require('../assets/images/logo_animation.gif')}
            style={{ width: 120, height: 120 }}
            resizeMode="contain"
          />
        </Animated.View>
        
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{message}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 20,
    color: '#2D3748',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 20,
  },
});

export default LoadingSplash;