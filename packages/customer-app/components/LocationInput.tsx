import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Alert } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Ionicons } from '@expo/vector-icons';
import { API_CONFIG } from '../config/api';

interface LocationInputProps {
  placeholder: string;
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
}

export interface LocationInputRef {
  getAddressText: () => string;
  setAddressText: (address: string) => void;
  clear: () => void;
}

const LocationInput = forwardRef<LocationInputRef, LocationInputProps>(
  ({ placeholder, onLocationSelect, onFocus = () => {}, disabled = false, disabledText }, ref) => {
    const googlePlacesRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      getAddressText: () => {
        return googlePlacesRef.current?.getAddressText() || '';
      },
      setAddressText: (address: string) => {
        googlePlacesRef.current?.setAddressText(address);
      },
      clear: () => {
        googlePlacesRef.current?.clear();
      },
    }));

    if (disabled) {
      return (
        <View style={styles.disabledContainer}>
          <Ionicons name="location" size={20} color="#9CA3AF" style={styles.inputIcon} />
          <Text style={styles.disabledText}>{disabledText || 'Konum seçildi'}</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <GooglePlacesAutocomplete
          ref={googlePlacesRef}
          placeholder={placeholder}
          predefinedPlaces={[]}
          enablePoweredByContainer={false}
          suppressDefaultStyles={false}
          listEmptyComponent={() => null}

          textInputProps={{
            onFocus: () => {
              console.log('🎯 LocationInput onFocus triggered');
              Alert.alert('Focus', 'Input focus oldu!');
              onFocus();
            },
            onChangeText: (text) => {
              console.log('📝 LocationInput onChangeText:', text);
            },
            returnKeyType: 'search',
            returnKeyLabel: 'Ara',
          }}
          onPress={(data, details = null) => {
            console.log('🔍 GooglePlacesAutocomplete onPress triggered - RAW DATA:', data);
            console.log('🔍 GooglePlacesAutocomplete onPress triggered - RAW DETAILS:', details);
            Alert.alert('TEST', 'LocationInput onPress çalıştı! Details: ' + (details ? 'VAR' : 'YOK'));
            
            let location;
            
            if (details && details.geometry && details.geometry.location) {
              // API key geçerli, detaylar var
              location = {
                address: details.formatted_address || data.description,
                coordinates: {
                  latitude: details.geometry.location.lat,
                  longitude: details.geometry.location.lng,
                },
              };
              console.log('📍 Location with details:', location);
            } else {
              // API key geçersiz veya details yok, sadece data kullan
              location = {
                address: data.description || data.structured_formatting?.main_text || 'Bilinmeyen Adres',
                coordinates: {
                  latitude: 0, // Koordinat bilgisi yok
                  longitude: 0,
                },
              };
              console.log('📍 Location without details (API key issue?):', location);
            }
            
            onLocationSelect?.(location);
            
            if (details) {
              
              // Input alanını seçilen adresle güncelle
               if (googlePlacesRef.current) {
                 googlePlacesRef.current.setAddressText(location.address);
               }
             } else {
               console.log('⚠️ Details is null, using data only');
               const location = {
                 address: data.description,
                 coordinates: {
                   latitude: 0,
                   longitude: 0,
                 },
               };
               onLocationSelect?.(location);
               
               // Input alanını seçilen adresle güncelle
               if (googlePlacesRef.current) {
                 googlePlacesRef.current.setAddressText(location.address);
               }
            }
          }}
            query={{
            key: Platform.OS === 'ios' ? API_CONFIG.GOOGLE_PLACES_API_KEY_IOS : API_CONFIG.GOOGLE_PLACES_API_KEY_ANDROID,
            language: 'tr',
            components: 'country:tr',
          }}
          fetchDetails={true}
          disableScroll={true}
          minLength={2}
          onFail={(error) => {
            console.log('❌ GooglePlacesAutocomplete onFail:', error);
            Alert.alert('Hata', 'Google Places API hatası: ' + JSON.stringify(error));
          }}
          onNotFound={() => {
            console.log('🔍 GooglePlacesAutocomplete onNotFound');
            Alert.alert('Bulunamadı', 'Konum bulunamadı');
          }}
          requestUrl={{
            url: 'https://maps.googleapis.com/maps/api/place/autocomplete/json',
            useOnPlatform: 'web',
          }}
          styles={{
            container: styles.placesContainer,
            textInput: styles.placesInput,
            listView: styles.placesList,
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

          debounce={200}
        />
      </View>
    );
  }
);

LocationInput.displayName = 'LocationInput';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  placesContainer: {
    flex: 1,
    zIndex: 1,
  },
  placesInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  placesList: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#FFFFFF',
    maxHeight: 200,
  },
  disabledContainer: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    marginRight: 8,
  },
  disabledText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});

export default LocationInput;