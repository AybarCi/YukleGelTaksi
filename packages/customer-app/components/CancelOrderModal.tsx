import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import socketService from '../services/socketService';

interface CancelOrderModalProps {
  visible: boolean;
  onClose: () => void;
  cancelOrderId: number | null;
  userCancelCode: string;
  setUserCancelCode: (code: string) => void;
  confirmCodeInputs: string[];
  setConfirmCodeInputs: (inputs: string[]) => void;
  confirmCodeInputRefs: React.MutableRefObject<(TextInput | null)[]>;
  showModal: (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
}

const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  visible,
  onClose,
  cancelOrderId,
  userCancelCode,
  setUserCancelCode,
  confirmCodeInputs,
  setConfirmCodeInputs,
  confirmCodeInputRefs,
  showModal,
}) => {
  const handleClose = () => {
    onClose();
    setUserCancelCode('');
    setConfirmCodeInputs(['', '', '', '']);
    setTimeout(() => {
      confirmCodeInputRefs.current[0]?.focus();
    }, 100);
  };

  const handleConfirm = () => {
    if (userCancelCode.length === 4 && cancelOrderId) {
      console.log('🔴 Confirm code ile iptal işlemi:', userCancelCode);
      const success = socketService.cancelOrderWithCode(cancelOrderId, userCancelCode);
      if (success) {
        onClose();
        setUserCancelCode('');
        setConfirmCodeInputs(['', '', '', '']);
        showModal('Başarılı', 'Sipariş iptal işlemi başlatıldı.', 'success');
      } else {
        showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
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
          width: '85%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5
        }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#10B981', textAlign: 'center' }}>
            ✅ Doğrulama Kodu Girin
          </Text>
          
          <Text style={{ fontSize: 16, marginBottom: 20, color: '#6B7280', textAlign: 'center' }}>
            Sipariş iptal işlemini tamamlamak için 4 haneli doğrulama kodunu girin:
          </Text>
          
          {/* 4 ayrı input kutusu */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 30
          }}>
            {[0, 1, 2, 3].map((index) => (
              <TextInput
                key={index}
                style={{
                  width: 60,
                  height: 60,
                  borderWidth: 2,
                  borderColor: confirmCodeInputs[index] ? '#F59E0B' : '#E5E7EB',
                  backgroundColor: '#F9FAFB',
                  borderRadius: 12,
                  textAlign: 'center',
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#1F2937',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 2
                }}
                value={confirmCodeInputs[index]}
                onChangeText={(text) => {
                  if (text.length <= 1 && /^[0-9]*$/.test(text)) {
                    const newInputs = [...confirmCodeInputs];
                    newInputs[index] = text;
                    setConfirmCodeInputs(newInputs);
                    setUserCancelCode(newInputs.join(''));
                    
                    // Eğer bir karakter girildi ve sonraki input varsa, ona geç
                    if (text && index < 3) {
                      confirmCodeInputRefs.current[index + 1]?.focus();
                    }
                  }
                }}
                onKeyPress={({ nativeEvent }) => {
                  // Backspace tuşuna basıldığında önceki input'a geç
                  if (nativeEvent.key === 'Backspace' && !confirmCodeInputs[index] && index > 0) {
                    confirmCodeInputRefs.current[index - 1]?.focus();
                  }
                }}
                keyboardType="numeric"
                maxLength={1}
                ref={(ref) => {
                  if (ref) {
                    confirmCodeInputRefs.current[index] = ref;
                  }
                }}
              />
            ))}
          </View>
          
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
              onPress={handleClose}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>Vazgeç</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={{
                backgroundColor: userCancelCode.length === 4 ? '#10B981' : '#9CA3AF',
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 8,
                flex: 1,
                marginLeft: 10
              }}
              disabled={userCancelCode.length !== 4}
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

export default CancelOrderModal;