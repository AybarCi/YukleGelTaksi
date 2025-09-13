import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin, Navigation, Target } from 'lucide-react-native';

interface LocationPickerProps {
  pickupLocation: string;
  setPickupLocation: (location: string) => void;
  deliveryLocation: string;
  setDeliveryLocation: (location: string) => void;
}

export default function LocationPicker({
  pickupLocation,
  setPickupLocation,
  deliveryLocation,
  setDeliveryLocation,
}: LocationPickerProps) {
  const detectCurrentLocation = () => {
    // Simulate GPS detection
    setPickupLocation('Mevcut Konumum (Kadıköy, İstanbul)');
  };

  return (
    <View style={styles.container}>
      {/* Pickup Location */}
      <View style={styles.locationContainer}>
        <View style={styles.locationHeader}>
          <MapPin size={20} color="#F97316" />
          <Text style={styles.locationLabel}>Yükleme Adresi</Text>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.locationInput}
            value={pickupLocation}
            onChangeText={setPickupLocation}
            placeholder="Yükleme adresini girin..."
          />
          <TouchableOpacity style={styles.gpsButton} onPress={detectCurrentLocation}>
            <Target size={16} color="#3B82F6" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Route Line */}
      <View style={styles.routeLine}>
        <View style={styles.routeDot} />
        <View style={styles.routePath} />
        <View style={styles.routeDot} />
      </View>

      {/* Delivery Location */}
      <View style={styles.locationContainer}>
        <View style={styles.locationHeader}>
          <Navigation size={20} color="#10B981" />
          <Text style={styles.locationLabel}>Teslimat Adresi</Text>
        </View>
        <TextInput
          style={styles.locationInput}
          value={deliveryLocation}
          onChangeText={setDeliveryLocation}
          placeholder="Teslimat adresini girin..."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  locationContainer: {
    marginBottom: 8,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  gpsButton: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  routeLine: {
    alignItems: 'center',
    marginVertical: 8,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B7280',
    marginVertical: 2,
  },
  routePath: {
    width: 2,
    height: 20,
    backgroundColor: '#D1D5DB',
  },
});