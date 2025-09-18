import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onPayment: () => void;
  onDirectCancel: () => void;
  cancellationFee: number;
  estimatedAmount: number;
  orderId: number;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  onPayment,
  onDirectCancel,
  cancellationFee,
  estimatedAmount,
  orderId,
}) => {
  const feePercentage = ((cancellationFee / estimatedAmount) * 100).toFixed(1);
  const hasFee = cancellationFee > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {hasFee ? (
            <>
              {/* Cezai Şart Var */}
              <View style={styles.header}>
                <Text style={styles.headerIcon}>⚠️</Text>
                <Text style={styles.headerTitle}>Cezai Şart Bildirimi</Text>
              </View>
              
              <View style={styles.content}>
                <Text style={styles.orderInfo}>Sipariş #{orderId}</Text>
                
                <View style={styles.feeSection}>
                  <Text style={styles.feeLabel}>Cezai Şart Tutarı</Text>
                  <Text style={styles.feeAmount}>₺{cancellationFee.toFixed(2)}</Text>
                  <Text style={styles.feeDescription}>
                    Tahmini tutar üzerinden %{feePercentage} cezai şart uygulanacaktır.
                  </Text>
                </View>

                <View style={styles.detailsContainer}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tahmini Tutar:</Text>
                    <Text style={styles.detailValue}>₺{estimatedAmount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Cezai Şart:</Text>
                    <Text style={[styles.detailValue, styles.feeValue]}>₺{cancellationFee.toFixed(2)}</Text>
                  </View>
                </View>

                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    💡 Sipariş iptal etmek için önce cezai şart tutarını ödemeniz gerekmektedir.
                  </Text>
                </View>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>Vazgeç</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.paymentButton} onPress={onPayment}>
                  <Text style={styles.paymentButtonText}>Ödeme Yap</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* Cezai Şart Yok */}
              <View style={styles.header}>
                <Text style={styles.headerIcon}>✅</Text>
                <Text style={styles.headerTitle}>Sipariş İptal</Text>
              </View>
              
              <View style={styles.content}>
                <Text style={styles.orderInfo}>Sipariş #{orderId}</Text>
                
                <View style={styles.noFeeSection}>
                  <Text style={styles.noFeeTitle}>Cezai Şart Uygulanmayacak</Text>
                  <Text style={styles.noFeeDescription}>
                    Bu sipariş için herhangi bir cezai şart tutarı bulunmamaktadır. 
                    Doğrudan iptal işlemini gerçekleştirebilirsiniz.
                  </Text>
                </View>

                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    ℹ️ İptal işlemini tamamlamak için 4 haneli doğrulama kodunu girmeniz yeterlidir.
                  </Text>
                </View>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>Vazgeç</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.directCancelButton} onPress={onDirectCancel}>
                  <Text style={styles.directCancelButtonText}>İptal Et</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  orderInfo: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  feeSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  feeLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  feeAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 8,
  },
  feeDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  noFeeSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  noFeeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 8,
  },
  noFeeDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  detailsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  feeValue: {
    color: '#DC2626',
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6B7280',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  paymentButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  directCancelButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  directCancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PaymentModal;