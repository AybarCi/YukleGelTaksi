import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Package, Armchair, Truck, Box } from 'lucide-react-native';

interface CargoTypeSelectorProps {
  selectedType: string;
  onTypeSelect: (type: string) => void;
}

export default function CargoTypeSelector({ selectedType, onTypeSelect }: CargoTypeSelectorProps) {
  const cargoTypes = [
    { id: 'furniture', name: 'Mobilya', icon: Armchair, color: '#8B5CF6' },
    { id: 'appliance', name: 'Beyaz Eşya', icon: Package, color: '#3B82F6' },
    { id: 'package', name: 'Koli/Paket', icon: Box, color: '#10B981' },
    { id: 'other', name: 'Diğer', icon: Truck, color: '#F59E0B' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Yük Türü Seçin</Text>
      <View style={styles.typeGrid}>
        {cargoTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.typeCard,
              selectedType === type.id && styles.selectedCard,
              { borderColor: type.color }
            ]}
            onPress={() => onTypeSelect(type.id)}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${type.color}20` }]}>
              <type.icon size={24} color={type.color} />
            </View>
            <Text style={[
              styles.typeName,
              selectedType === type.id && styles.selectedTypeName
            ]}>
              {type.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
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
});