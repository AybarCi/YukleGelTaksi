import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_CONFIG } from '../config/api';

interface VehicleType {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  image_url?: string;
  base_price?: number;
}

interface VehicleTypeModalProps {
  visible: boolean;
  onClose: () => void;
  vehicleTypes: VehicleType[];
  selectedVehicleType: VehicleType | null;
  onSelectVehicleType: (vehicleType: VehicleType) => void;
}

const VehicleTypeModal: React.FC<VehicleTypeModalProps> = ({
  visible,
  onClose,
  vehicleTypes,
  selectedVehicleType,
  onSelectVehicleType,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Araç Tipi Seçin</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.content}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {vehicleTypes.map((vehicleType) => (
                <TouchableOpacity
                  key={vehicleType.id}
                  style={[
                    styles.option,
                    selectedVehicleType?.id === vehicleType.id && {
                      backgroundColor: '#FEF3C7',
                      borderColor: '#F59E0B',
                    }
                  ]}
                  onPress={() => {
                    onSelectVehicleType(vehicleType);
                    onClose();
                  }}
                >
                  <View style={[
                    styles.iconContainer,
                    selectedVehicleType?.id === vehicleType.id && {
                      backgroundColor: '#F59E0B',
                    }
                  ]}>
                    {vehicleType.image_url ? (
                      <Image 
                        source={{ uri: `${API_CONFIG.BASE_URL}${vehicleType.image_url}` }}
                        style={styles.vehicleTypeImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons 
                        name="car" 
                        size={24} 
                        color={selectedVehicleType?.id === vehicleType.id ? '#FFFFFF' : '#F59E0B'} 
                      />
                    )}
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>{vehicleType.name}</Text>
                    <Text style={styles.optionSubtitle}>{vehicleType.description}</Text>
                    {vehicleType.base_price && (
                      <Text style={styles.vehicleTypeBasePrice}>
                        Başlangıç ücreti: ₺{vehicleType.base_price}
                      </Text>
                    )}
                  </View>
                  {selectedVehicleType?.id === vehicleType.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
    paddingTop: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  optionTextContainer: {
    flex: 1,
  },
  vehicleTypeImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  vehicleTypeBasePrice: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
  },
});

export default VehicleTypeModal;