import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin, Navigation, Target } from 'lucide-react-native';

interface LocationStepProps {
  data: any;
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function LocationStep({ data, onUpdate, onNext, onBack }: LocationStepProps) {
  const handleLocationUpdate = (field: string, value: string) => {
    onUpdate({ [field]: value });
  };

  const detectCurrentLocation = () => {
    onUpdate({ pickupLocation: 'Mevcut Konumum (Kadıköy, İstanbul)' });
  };

  const canProceed = data.pickupLocation && data.deliveryLocation;

  return (
    <View style={styles.container}>
      <Text style={styles.description}>
        Yükünüzü nereden nereye göndermek istiyorsunuz?
      </Text>

      {/* Pickup Location */}
      <View style={styles.locationContainer}>
        <View style={styles.locationHeader}>
          <MapPin size={20} color="#F97316" />
          <Text style={styles.locationLabel}>Nereden</Text>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.locationInput}
            value={data.pickupLocation}
            onChangeText={(value) => handleLocationUpdate('pickupLocation', value)}
            placeholder="Yükün alınacağı adres..."
            multiline
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
          <Text style={styles.locationLabel}>Nereye</Text>
        </View>
        <TextInput
          style={styles.locationInput}
          value={data.deliveryLocation}
          onChangeText={(value) => handleLocationUpdate('deliveryLocation', value)}
          placeholder="Yükün teslim edileceği adres..."
          multiline
        />
      </View>

      {/* Continue Button */}
      <TouchableOpacity 
        style={[styles.continueButton, !canProceed && styles.continueButtonDisabled]}
        onPress={onNext}
        disabled={!canProceed}
      >
        <Text style={styles.continueButtonText}>Devam Et</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  locationContainer: {
    marginBottom: 16,
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
    alignItems: 'flex-start',
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
    minHeight: 48,
  },
  gpsButton: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginTop: 2,
  },
  routeLine: {
    alignItems: 'center',
    marginVertical: 12,
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
  continueButton: {
    backgroundColor: '#FCD34D',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    elevation: 2,
    shadowColor: '#FCD34D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  continueButtonDisabled: {
    backgroundColor: '#D1D5DB',
    elevation: 0,
    shadowOpacity: 0,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
});