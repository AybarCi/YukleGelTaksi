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

interface CargoType {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  labor_count: number;
  created_at: string;
  updated_at: string;
}

interface CargoTypeModalProps {
  visible: boolean;
  onClose: () => void;
  cargoTypes: CargoType[];
  selectedCargoType: CargoType | null;
  onSelectCargoType: (cargoType: CargoType) => void;
}

const CargoTypeModal: React.FC<CargoTypeModalProps> = ({
  visible,
  onClose,
  cargoTypes,
  selectedCargoType,
  onSelectCargoType,
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
            <Text style={styles.title}>Yük Tipi Seçin</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.content}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {cargoTypes.map((cargoType) => (
                <TouchableOpacity
                  key={cargoType.id}
                  style={[
                    styles.option,
                    selectedCargoType?.id === cargoType.id && {
                      backgroundColor: '#FEF3C7',
                      borderColor: '#F59E0B',
                    }
                  ]}
                  onPress={() => {
                    onSelectCargoType(cargoType);
                    onClose();
                  }}
                >
                  <View style={[
                    styles.iconContainer,
                    selectedCargoType?.id === cargoType.id && {
                      backgroundColor: '#F59E0B',
                    }
                  ]}>
                    {cargoType.image_url ? (
                      <Image 
                        source={{ uri: `${API_CONFIG.BASE_URL}${cargoType.image_url}` }}
                        style={styles.cargoTypeImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons 
                        name="cube" 
                        size={24} 
                        color={selectedCargoType?.id === cargoType.id ? '#FFFFFF' : '#F59E0B'} 
                      />
                    )}
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>{cargoType.name}</Text>
                    <Text style={styles.optionSubtitle}>{cargoType.description}</Text>
                    <Text style={styles.laborInfo}>
                      Hammaliye: {cargoType.labor_count} kişi eklenecektir.
                    </Text>
                  </View>
                  {selectedCargoType?.id === cargoType.id && (
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
    marginBottom: 4,
    maxHeight: 63, // 3 lines * 21px (line height)
    lineHeight: 21,
    overflow: 'hidden',
  },
  laborInfo: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  optionTextContainer: {
    flex: 1,
  },
  cargoTypeImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
});

export default CargoTypeModal;