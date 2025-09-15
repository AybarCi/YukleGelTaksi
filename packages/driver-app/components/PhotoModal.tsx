import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import {
  PinchGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

interface PhotoModalProps {
  visible: boolean;
  photoUrls: string[];
  currentImageIndex: number;
  onClose: () => void;
  onImageIndexChange: (index: number) => void;
}

export const PhotoModal: React.FC<PhotoModalProps> = ({
  visible,
  photoUrls,
  currentImageIndex,
  onClose,
  onImageIndexChange,
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  
  // Animation refs
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const pinchRef = useRef(null);

  const resetImageTransform = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    Animated.timing(translateX, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    Animated.timing(translateY, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setIsZoomed(false);
  };

  const goToNextImage = () => {
    if (!isZoomed) {
      const nextIndex = currentImageIndex === photoUrls.length - 1 ? 0 : currentImageIndex + 1;
      onImageIndexChange(nextIndex);
      resetImageTransform();
    }
  };

  const goToPreviousImage = () => {
    if (!isZoomed) {
      const prevIndex = currentImageIndex === 0 ? photoUrls.length - 1 : currentImageIndex - 1;
      onImageIndexChange(prevIndex);
      resetImageTransform();
    }
  };

  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: scale } }],
    { useNativeDriver: true }
  );

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const currentScale = event.nativeEvent.scale;
      
      if (currentScale < 1) {
        resetImageTransform();
      } else if (currentScale > 3) {
        Animated.timing(scale, {
          toValue: 3,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
      
      setIsZoomed(currentScale > 1);
    }
  };

  const handleClose = () => {
    resetImageTransform();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.photoModalOverlay}>
        <View style={styles.photoModalContainer}>
          {/* Modal Header */}
          <View style={styles.photoModalHeader}>
            <Text style={styles.photoModalTitle}>
              {currentImageIndex + 1} / {photoUrls.length}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
            >
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Fotoğraf Container */}
          <View style={styles.photoContainer}>
            {photoUrls.length > 0 && (
              <PinchGestureHandler
                ref={pinchRef}
                onGestureEvent={onPinchGestureEvent}
                onHandlerStateChange={onPinchHandlerStateChange}
              >
                <Animated.Image
                  source={{ uri: photoUrls[currentImageIndex] }}
                  style={[
                    styles.fullScreenImage,
                    {
                      transform: [
                        { scale: scale },
                        { translateX: translateX },
                        { translateY: translateY },
                      ],
                    },
                  ]}
                  resizeMode="contain"
                />
              </PinchGestureHandler>
            )}

            {/* Sol Ok */}
            {photoUrls.length > 1 && (
              <TouchableOpacity
                style={[styles.navigationArrow, styles.leftArrow]}
                onPress={goToPreviousImage}
              >
                <Ionicons name="chevron-back" size={30} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {/* Sağ Ok */}
            {photoUrls.length > 1 && (
              <TouchableOpacity
                style={[styles.navigationArrow, styles.rightArrow]}
                onPress={goToNextImage}
              >
                <Ionicons name="chevron-forward" size={30} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  photoModalHeader: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  photoModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fullScreenImage: {
    width: width,
    height: height * 0.7,
  },
  navigationArrow: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -25,
  },
  leftArrow: {
    left: 20,
  },
  rightArrow: {
    right: 20,
  },
});