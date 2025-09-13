import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Package, Armchair, Truck, Box, Camera } from 'lucide-react-native';

interface CargoStepProps {
  data: any;
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function CargoStep({ data, onUpdate, onNext, onBack }: CargoStepProps) {
  const cargoTypes = [
    { id: 'furniture', name: 'Mobilya', icon: Armchair, color: '#8B5CF6' },
    { id: 'appliance', name: 'Beyaz Eşya', icon: Package, color: '#3B82F6' },
    { id: 'package', name: 'Koli/Paket', icon: Box, color: '#10B981' },
    { id: 'other', name: 'Diğer', icon: Truck, color: '#F59E0B' },
  ];

  const handleUpdate = (field: string, value: string) => {
    onUpdate({ [field]: value });
  };

  const canProceed = data.cargoType && data.cargoWeight;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.description}>
        Ne göndermek istiyorsunuz?
      </Text>

      {/* Cargo Type Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ne gönderiyorsunuz?</Text>
        <View style={styles.typeGrid}>
          {cargoTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.typeCard,
                data.cargoType === type.id && styles.selectedCard,
                { borderColor: type.color }
              ]}
              onPress={() => handleUpdate('cargoType', type.id)}
            >
              <View style={[styles.iconContainer, { backgroundColor: `${type.color}20` }]}>
                <type.icon size={24} color={type.color} />
              </View>
              <Text style={[
                styles.typeName,
                data.cargoType === type.id && styles.selectedTypeName
              ]}>
                {type.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Weight Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Yaklaşık ağırlığı nedir?</Text>
        <View style={styles.weightContainer}>
          <TextInput
            style={styles.weightInput}
            value={data.cargoWeight}
            onChangeText={(value) => handleUpdate('cargoWeight', value)}
            placeholder="Örn: 25"
            keyboardType="numeric"
          />
          <Text style={styles.weightUnit}>kg</Text>
        </View>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ek bilgi (İsteğe bağlı)</Text>
        <TextInput
          style={styles.descriptionInput}
          value={data.cargoDescription}
          onChangeText={(value) => handleUpdate('cargoDescription', value)}
          placeholder="Özel talimatlar, kırılabilir eşya vb..."
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Photo Upload */}
      <TouchableOpacity style={styles.photoButton}>
        <Camera size={20} color="#6B7280" />
        <Text style={styles.photoButtonText}>Fotoğraf Ekle (İsteğe bağlı)</Text>
      </TouchableOpacity>

      {/* Continue Button */}
      <TouchableOpacity 
        style={[styles.continueButton, !canProceed && styles.continueButtonDisabled]}
        onPress={onNext}
        disabled={!canProceed}
      >
        <Text style={styles.continueButtonText}>Sürücü Bul</Text>
      </TouchableOpacity>
    </ScrollView>
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  selectedCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  typeName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  selectedTypeName: {
    color: '#1F2937',
    fontWeight: '600',
  },
  weightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  weightInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  weightUnit: {
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    height: 80,
    textAlignVertical: 'top',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 24,
  },
  photoButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  continueButton: {
    backgroundColor: '#FCD34D',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
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
  offerButton: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    elevation: 2,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  offerButtonDisabled: {
    backgroundColor: '#D1D5DB',
    elevation: 0,
    shadowOpacity: 0,
  },
  offerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});