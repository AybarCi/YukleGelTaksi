import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Ionicons } from '@expo/vector-icons';
import { API_CONFIG } from '../config/api';

interface VarisNoktasiInputProps {
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

export interface VarisNoktasiInputRef {
  getAddressText: () => string;
  setAddressText: (address: string) => void;
  clear: () => void;
}

const VarisNoktasiInput = forwardRef<VarisNoktasiInputRef, VarisNoktasiInputProps>(
  ({ 
    onLocationSelect, 
    onFocus = () => {}, 
    disabled = false, 
    disabledText
  }, ref) => {
    const googlePlacesRef = useRef<any>(null);
    const [inputText, setInputText] = React.useState('');
    const [showList, setShowList] = React.useState(false);

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

    if (disabled) {
      return (
        <View style={styles.disabledContainer}>
          <Ionicons name="flag" size={20} color="#9CA3AF" style={styles.inputIcon} />
          <Text style={styles.disabledText}>{disabledText || 'Varış noktası seçildi'}</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Ionicons name="flag-outline" size={20} color="#10B981" />
            <Text style={styles.headerText}>Varış Noktası</Text>
          </View>
        </View>
        
        <GooglePlacesAutocomplete
          ref={googlePlacesRef}
          placeholder="Yükün teslim edileceği adresi yazın..."
          predefinedPlaces={[]}
          enablePoweredByContainer={false}
          suppressDefaultStyles={true}
          listEmptyComponent={() => null}
          keyboardShouldPersistTaps="handled"
          keepResultsAfterBlur={true}
          listViewDisplayed={showList}
          debounce={200}
          nearbyPlacesAPI="GooglePlacesSearch"

          textInputProps={{
            value: inputText,
            onChangeText: setInputText,
            onFocus: () => {
              setShowList(true);
              onFocus();
            },
            onBlur: () => {
              setTimeout(() => setShowList(false), 150);
            },
            returnKeyType: 'search',
            returnKeyLabel: 'Ara',
          }}
          onPress={(data, details = null) => {
      console.log('VarisNoktasiInput - onPress called');
      console.log('Data:', data);
      console.log('Details:', details);
      
      const selectedAddress = details?.formatted_address || data.description;
      console.log('Selected Address:', selectedAddress);
      
      setInputText(selectedAddress);
      
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
      
      // onLocationSelect prop'unu çağır
      if (onLocationSelect) {
        onLocationSelect(location);
      }
      
      // Liste kapanması için state güncelleme
      setShowList(false);
      if (googlePlacesRef.current) {
        googlePlacesRef.current.setAddressText(selectedAddress);
        // Liste görünürlüğünü kapatmak için
        googlePlacesRef.current.blur();
      }
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
        />
      </View>
    );
  }
);

VarisNoktasiInput.displayName = 'VarisNoktasiInput';

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
  placesContainer: {
    flex: 1,
    zIndex: 999,
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
    zIndex: 999,
    elevation: 999,
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
  inputIcon: {
    marginRight: 8,
  },
  disabledText: {
    fontSize: 16,
    color: '#6B7280',
  },
});

export default VarisNoktasiInput;