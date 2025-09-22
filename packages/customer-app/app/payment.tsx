import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import socketService from '../services/socketService';
import { useAuth } from '../contexts/AuthContext';

interface PaymentScreenProps {}

const PaymentScreen: React.FC<PaymentScreenProps> = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const { showModal } = useAuth();
  
  // URL parametrelerinden bilgileri al
  const orderId = params.orderId as string;
  const cancellationFee = params.cancellationFee as string;
  const estimatedAmount = params.estimatedAmount as string;
  
  const { user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Gerekli parametreler yoksa ana sayfaya yönlendir
    if (!orderId || !cancellationFee || !estimatedAmount) {
      showModal('Hata', 'Ödeme bilgileri eksik. Ana sayfaya yönlendiriliyorsunuz.', 'error');
      router.replace('/home');
    }
  }, [orderId, cancellationFee, estimatedAmount]);

  const handlePayment = async () => {
    setIsProcessing(true);
    
    try {
      // Burada gerçek ödeme işlemi yapılacak
      // Şimdilik simüle ediyoruz
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      showModal(
        'Ödeme Başarılı',
        'Cezai şart ödemesi tamamlandı. Şimdi sipariş iptal işlemini tamamlayabilirsiniz.',
        'success',
        [
          {
            text: 'Tamam',
            onPress: () => {
              // Ödeme başarılı olduğunda doğrulama kodu modalına yönlendir
              router.replace({
                pathname: '/home',
                params: {
                  showCancelModal: 'true',
                  orderId: orderId,
                  paymentCompleted: 'true'
                }
              });
            }
          }
        ]
      );
    } catch (error) {
      showModal('Ödeme Hatası', 'Ödeme işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    showModal(
      'Ödeme İptal',
      'Ödeme işlemini iptal etmek istediğinizden emin misiniz?',
      'warning',
      [
        { text: 'Hayır', style: 'cancel' },
        {
          text: 'Evet',
          onPress: () => router.back()
        }
      ]
    );
  };

  if (!orderId || !cancellationFee || !estimatedAmount) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  const feeAmount = parseFloat(cancellationFee);
  const totalAmount = parseFloat(estimatedAmount);
  const feePercentage = ((feeAmount / totalAmount) * 100).toFixed(1);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cezai Şart Ödemesi</Text>
        <Text style={styles.headerSubtitle}>Sipariş #{orderId}</Text>
      </View>

      <View style={styles.paymentCard}>
        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>Ödeme Tutarı</Text>
          <Text style={styles.amountValue}>₺{feeAmount.toFixed(2)}</Text>
          <Text style={styles.amountDescription}>
            Tahmini tutar üzerinden %{feePercentage} cezai şart
          </Text>
        </View>

        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tahmini Tutar:</Text>
            <Text style={styles.detailValue}>₺{totalAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cezai Şart Oranı:</Text>
            <Text style={styles.detailValue}>%{feePercentage}</Text>
          </View>
          <View style={[styles.detailRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Ödenecek Tutar:</Text>
            <Text style={styles.totalValue}>₺{feeAmount.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>ℹ️ Bilgilendirme</Text>
          <Text style={styles.infoText}>
            • Cezai şart tutarı, sipariş iptal edilmeden önce ödenmelidir.
          </Text>
          <Text style={styles.infoText}>
            • Ödeme tamamlandıktan sonra sipariş iptal işlemini doğrulama kodu ile tamamlayabilirsiniz.
          </Text>
          <Text style={styles.infoText}>
            • Bu tutar, hizmet sağlayıcıya olan taahhüdünüzün karşılığıdır.
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={isProcessing}
        >
          <Text style={styles.cancelButtonText}>Vazgeç</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.payButtonText}>Ödemeyi Tamamla</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  amountSection: {
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 4,
  },
  amountDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  detailsSection: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  infoSection: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6B7280',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  payButton: {
    flex: 2,
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PaymentScreen;