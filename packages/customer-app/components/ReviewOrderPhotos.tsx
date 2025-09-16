import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Modal, Dimensions, SafeAreaView } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { API_CONFIG } from '../config/api';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ReviewOrderPhotosProps {
  cargoImages: string[];
  isEditable?: boolean;
  onImageAdd?: () => void;
  onImageRemove?: (index: number) => void;
  title?: string;
  required?: boolean;
}

const ReviewOrderPhotos: React.FC<ReviewOrderPhotosProps> = ({
  cargoImages,
  isEditable = false,
  onImageAdd,
  onImageRemove,
  title = 'Yük Fotoğrafı',
  required = true,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // URL'leri tam URL'ye dönüştür
  const getFullImageUrl = (imageUri: string) => {
    if (imageUri.startsWith('http')) {
      return imageUri;
    }
    // Eğer /uploads ile başlıyorsa BASE_URL ekle
    if (imageUri.startsWith('/uploads')) {
      return `${API_CONFIG.BASE_URL}${imageUri}`;
    }
    return imageUri;
  };

  const openImageModal = (index: number) => {
    setSelectedImageIndex(index);
    setModalVisible(true);
  };

  const closeImageModal = () => {
    setModalVisible(false);
  };

  const goToPreviousImage = () => {
    setSelectedImageIndex((prevIndex) => 
      prevIndex > 0 ? prevIndex - 1 : cargoImages.length - 1
    );
  };

  const goToNextImage = () => {
    setSelectedImageIndex((prevIndex) => 
      prevIndex < cargoImages.length - 1 ? prevIndex + 1 : 0
    );
  };

  // Swipe gesture handler
  const onGestureEvent = (event: any) => {
    const { translationX, state } = event.nativeEvent;
    
    if (state === State.END) {
      if (translationX > 50 && cargoImages.length > 1) {
        // Swipe right - go to previous image
        goToPreviousImage();
      } else if (translationX < -50 && cargoImages.length > 1) {
        // Swipe left - go to next image
        goToNextImage();
      }
    }
  };

  console.log('ReviewOrderPhotos - cargoImages:', cargoImages);
  console.log('ReviewOrderPhotos - API_CONFIG.BASE_URL:', API_CONFIG.BASE_URL);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      {cargoImages && cargoImages.length > 0 ? (
        <View style={[styles.photoContainer, { borderColor: '#E5E7EB' }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            scrollEventThrottle={16}
            decelerationRate="fast"
            bounces={false}
          >
            {cargoImages.map((imageUri, index) => {
              const fullImageUrl = getFullImageUrl(imageUri);
              console.log(`Image ${index}: ${imageUri} -> ${fullImageUrl}`);
              
              return (
                <View key={index} style={styles.imageWrapper}>
                  <TouchableOpacity onPress={() => openImageModal(index)}>
                    <Image 
                      source={{ uri: fullImageUrl }} 
                      style={styles.image}
                      onError={(error) => {
                        console.log(`Image load error for ${fullImageUrl}:`, error.nativeEvent.error);
                      }}
                      onLoad={() => {
                        console.log(`Image loaded successfully: ${fullImageUrl}`);
                      }}
                    />
                  </TouchableOpacity>
                  {isEditable && onImageRemove && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        onImageRemove(index);
                      }}
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            
            {isEditable && onImageAdd && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={onImageAdd}
              >
                <Ionicons name="add" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      ) : (
        isEditable && onImageAdd && (
          <TouchableOpacity
            style={styles.emptyContainer}
            onPress={onImageAdd}
          >
            <Ionicons name="camera" size={32} color="#9CA3AF" />
            <Text style={styles.emptyText}>Yük fotoğrafı ekle</Text>
          </TouchableOpacity>
        )
      )}

      {/* Fotoğraf Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeImageModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {selectedImageIndex + 1} / {cargoImages.length}
              </Text>
              <View style={styles.placeholder} />
            </View>

            {/* Image Container */}
            <View style={styles.imageContainer}>
              {cargoImages.length > 0 && (
                <PanGestureHandler onGestureEvent={onGestureEvent}>
                  <View style={styles.gestureContainer}>
                    <Image
                      source={{ uri: getFullImageUrl(cargoImages[selectedImageIndex]) }}
                      style={styles.modalImage}
                      resizeMode="contain"
                    />
                  </View>
                </PanGestureHandler>
              )}

              {/* Navigation Buttons */}
              {cargoImages.length > 1 && (
                <>
                  <TouchableOpacity
                    style={[styles.navButton, styles.prevButton]}
                    onPress={goToPreviousImage}
                  >
                    <Ionicons name="chevron-back" size={30} color="white" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.navButton, styles.nextButton]}
                    onPress={goToNextImage}
                  >
                    <Ionicons name="chevron-forward" size={30} color="white" />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Bottom Thumbnail Strip */}
            {cargoImages.length > 1 && (
              <View style={styles.thumbnailContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbnailScrollContent}
                >
                  {cargoImages.map((imageUri, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setSelectedImageIndex(index)}
                      style={[
                        styles.thumbnailWrapper,
                        selectedImageIndex === index && styles.selectedThumbnail
                      ]}
                    >
                      <Image
                        source={{ uri: getFullImageUrl(imageUri) }}
                        style={styles.thumbnail}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#374151',
  },
  photoContainer: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 120,
    maxHeight: 200,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  emptyContainer: {
    height: 120,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  closeButton: {
    padding: 8,
  },
  modalTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  modalImage: {
    width: screenWidth,
    height: screenHeight * 0.7,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -25,
  },
  prevButton: {
    left: 20,
  },
  nextButton: {
    right: 20,
  },
  thumbnailContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 15,
  },
  thumbnailScrollContent: {
    paddingHorizontal: 20,
  },
  thumbnailWrapper: {
    marginRight: 10,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedThumbnail: {
    borderColor: '#3B82F6',
  },
  thumbnail: {
    width: 60,
    height: 60,
  },
  gestureContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ReviewOrderPhotos;