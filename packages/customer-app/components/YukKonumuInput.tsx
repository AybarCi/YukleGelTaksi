import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Modal, SafeAreaView } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Ionicons } from '@expo/vector-icons';
import { API_CONFIG } from '../config/api';

interface YukKonumuInputProps {
  onLocationSelect: (location: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  }) => void;
  onFocus?: () => void;
  disabled?: boolean;
  disabledText?: string;
  showCurrentLocationButton?: boolean;
  onCurrentLocationPress?: () => void;
  placeholder?: string;
  editable?: boolean;
}

export interface YukKonumuInputRef {
  getAddressText: () => string;
  setAddressText: (address: string) => void;
  clear: () => void;
}

const YukKonumuInput = forwardRef<YukKonumuInputRef, YukKonumuInputProps>(
  ({ 
    onLocationSelect, 
    onFocus = () => {}, 
    disabled = false, 
    disabledText,
    onCurrentLocationPress,
    placeholder = "Yükün alınacağı adresi seçin...",
    editable = true
  }, ref) => {
    const [inputText, setInputText] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [searchText, setSearchText] = useState('');

    useImperativeHandle(ref, () => ({
      getAddressText: () => {
        return inputText;
      },
      setAddressText: (address: string) => {
        setInputText(address);
      },
      clear: () => {
        setInputText('');
        
      },
    }));

    const handleLocationSelect = (location: any) => {
      console.log('YukKonumuInput - handleLocationSelect called with:', location);
      setInputText(location.address);
      setSearchText(location.address); // Arama metnini de güncelle
      setModalVisible(false);
      onLocationSelect(location);
    };

    const handleCurrentLocationPress = () => {
      setInputText('Mevcut Konumum');
      setModalVisible(false);
      if (onCurrentLocationPress) {
        onCurrentLocationPress();
      }
    };

    const handleSearchTextChange = (text: string) => {
      setSearchText(text);
    };

    useEffect(() => {
      console.log('YukKonumu Debug:', { 
        onCurrentLocationPress: !!onCurrentLocationPress, 
        searchTextLength: searchText.length, 
        searchText,
        modalVisible 
      });
    }, [onCurrentLocationPress, searchText, modalVisible]);

    if (disabled) {
      return (
        <View style={styles.disabledContainer}>
          <Ionicons name="location" size={20} color="#9CA3AF" style={styles.inputIcon} />
          <Text style={styles.disabledText}>{disabledText || 'Yük konumu seçildi'}</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Ionicons name="cube-outline" size={20} color="#F97316" />
            <Text style={styles.headerText}>Yükün Konumu</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={[
            styles.inputButton,
            !editable && {
              backgroundColor: '#F3F4F6',
              borderColor: '#D1D5DB',
              opacity: 0.6
            }
          ]}
          onPress={editable ? () => setModalVisible(true) : undefined}
          disabled={!editable}
        >
          <Ionicons name="location-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
          <Text style={[styles.inputText, !inputText && styles.placeholderText]}>
            {inputText || placeholder}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <Modal
          visible={modalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Yük Konumu Seçin</Text>
              <View style={styles.placeholder} />
            </View>

            <View style={styles.searchContainer}>
              <GooglePlacesAutocomplete
                placeholder="Adres arayın..."
                predefinedPlaces={[]}
                enablePoweredByContainer={false}
                suppressDefaultStyles={true}
                listEmptyComponent={() => null}
                keyboardShouldPersistTaps="handled"
                keepResultsAfterBlur={true}
                debounce={200}
                nearbyPlacesAPI="GooglePlacesSearch"
                enableHighAccuracyLocation={true}
                timeout={20000}
                textInputProps={{
                  value: searchText,
                  onChangeText: handleSearchTextChange,
                  autoFocus: true,
                  returnKeyType: 'search',
                  returnKeyLabel: 'Ara',
                }}
                onPress={(data, details = null) => {
                  const selectedAddress = details?.formatted_address || data.description;
                  
                  const location = {
                    address: selectedAddress,
                    coordinates: details ? {
                      latitude: details.geometry.location.lat,
                      longitude: details.geometry.location.lng,
                    } : {
                      latitude: 0,
                      longitude: 0,
                    },
                  };
                  
                  handleLocationSelect(location);
                  // setSearchText(''); // Bu satırı kaldırıyoruz ki seçilen adres görünür kalsın
                }}
                query={{
                  key: Platform.OS === 'ios' ? API_CONFIG.GOOGLE_PLACES_API_KEY_IOS : API_CONFIG.GOOGLE_PLACES_API_KEY_ANDROID,
                  language: 'tr',
                  components: 'country:tr',
                }}
                fetchDetails={true}
                disableScroll={true}
                minLength={3}
                styles={{
                  container: { flex: 0 },
                  textInput: {
                    height: 48,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    fontSize: 16,
                    backgroundColor: '#FFFFFF',
                    color: '#000000',
                  },
                  listView: {
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderTopWidth: 0,
                    borderBottomLeftRadius: 8,
                    borderBottomRightRadius: 8,
                    backgroundColor: '#FFFFFF',
                    maxHeight: 400,
                  },
                  row: {
                    backgroundColor: '#FFFFFF',
                    padding: 13,
                    height: 'auto',
                    minHeight: 44,
                    flexDirection: 'row',
                  },
                  separator: {
                    height: 0.5,
                    backgroundColor: '#E5E7EB',
                  },
                  description: {
                    fontWeight: '500',
                    color: '#1F2937',
                    fontSize: 16,
                  },
                  predefinedPlacesDescription: {
                    color: '#1faadb',
                  },
                }}
              />
              
              {onCurrentLocationPress && (!searchText || searchText.trim().length === 0) && (
                <TouchableOpacity 
                  style={styles.currentLocationButton}
                  onPress={handleCurrentLocationPress}
                >
                  <Ionicons name="navigate" size={20} color="#1F2937" />
                  <Text style={styles.currentLocationText}>Mevcut Konumumu Kullan</Text>
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </Modal>
      </View>
    );
  }
);

YukKonumuInput.displayName = 'YukKonumuInput';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  inputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  disabledContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  disabledText: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 32,
  },
  searchContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalPlacesContainer: {
    flex: 0,
  },
  modalPlacesInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  modalPlacesList: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#FFFFFF',
    maxHeight: 400,
  },
  currentLocationContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  currentLocationButtonContainer: {
    marginTop: 16,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 0,
    marginTop: 12,
    gap: 8,
  },
  currentLocationText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
});

export default YukKonumuInput;