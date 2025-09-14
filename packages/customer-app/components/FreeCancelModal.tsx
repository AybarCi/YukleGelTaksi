import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import socketService from '../services/socketService';

interface FreeCancelModalProps {
  visible: boolean;
  onClose: () => void;
  freeCancelConfirmCode: string;
  setFreeCancelConfirmCode: (code: string) => void;
  currentOrder: any;
  showModal: (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
}

const FreeCancelModal: React.FC<FreeCancelModalProps> = ({
  visible,
  onClose,
  freeCancelConfirmCode,
  setFreeCancelConfirmCode,
  currentOrder,
  showModal,
}) => {
  const handleCancel = () => {
    onClose();
    setFreeCancelConfirmCode('');
  };

  const handleConfirm = () => {
    if (freeCancelConfirmCode.length === 4) {
      socketService.verifyCancelCode(currentOrder.id, freeCancelConfirmCode);
      onClose();
      setFreeCancelConfirmCode('');
    } else {
      showModal('Hata', 'Lütfen 4 haneli onay kodunu girin.', 'error');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <View style={{
          backgroundColor: '#FFFFFF',
          margin: 20,
          borderRadius: 12,
          padding: 20,
          width: '80%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5
        }}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#1F2937', textAlign: 'center' }}>
            Ücretsiz İptal
          </Text>
          <Text style={{ fontSize: 16, marginBottom: 20, color: '#6B7280', textAlign: 'center', lineHeight: 22 }}>
            Siparişinizi ücretsiz olarak iptal edebilirsiniz. Lütfen onay kodunu girin:
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#D1D5DB',
              borderRadius: 8,
              padding: 12,
              fontSize: 18,
              textAlign: 'center',
              marginBottom: 20,
              letterSpacing: 4
            }}
            placeholder="0000"
            value={freeCancelConfirmCode}
            onChangeText={setFreeCancelConfirmCode}
            keyboardType="numeric"
            maxLength={4}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity
              style={{
                backgroundColor: '#6B7280',
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 8,
                flex: 1,
                marginRight: 10
              }}
              onPress={handleCancel}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: '#10B981',
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 8,
                flex: 1,
                marginLeft: 10
              }}
              onPress={handleConfirm}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>İptal Et</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default FreeCancelModal;