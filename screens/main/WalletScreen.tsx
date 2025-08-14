import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

interface Transaction {
  id: number;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  created_at: string;
  status: 'completed' | 'pending' | 'failed';
}

const WalletScreen: React.FC = () => {
  const { user, refreshProfile, showModal } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [addAmount, setAddAmount] = useState('');

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement API call to fetch transactions
      // For now, using mock data
      const mockTransactions: Transaction[] = [
        {
          id: 1,
          type: 'debit',
          amount: 45.50,
          description: 'Kadıköy - Beşiktaş yolculuğu',
          created_at: '2024-01-15T10:30:00Z',
          status: 'completed',
        },
        {
          id: 2,
          type: 'credit',
          amount: 100.00,
          description: 'Cüzdan yüklemesi',
          created_at: '2024-01-14T16:20:00Z',
          status: 'completed',
        },
        {
          id: 3,
          type: 'debit',
          amount: 85.00,
          description: 'Taksim - Havalimanı yolculuğu',
          created_at: '2024-01-10T14:15:00Z',
          status: 'completed',
        },
      ];
      setTransactions(mockTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadTransactions(), refreshProfile()]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const handleAddMoney = async () => {
    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount <= 0) {
      showModal('Hata', 'Geçerli bir miktar girin', 'error');
      return;
    }

    if (amount < 10) {
      showModal('Hata', 'Minimum yükleme miktarı 10 TL\'dir', 'error');
      return;
    }

    if (amount > 1000) {
      showModal('Hata', 'Maksimum yükleme miktarı 1000 TL\'dir', 'error');
      return;
    }

    try {
      // TODO: Implement API call to add money
      showModal('Başarılı', `${amount.toFixed(2)} TL cüzdanınıza eklenmiştir`, 'success');
      setShowAddMoneyModal(false);
      setAddAmount('');
      await refreshProfile();
    } catch (error) {
      showModal('Hata', 'Para ekleme işlemi başarısız oldu', 'error');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type: string) => {
    return type === 'credit' ? 'add-circle' : 'remove-circle';
  };

  const getTransactionColor = (type: string) => {
    return type === 'credit' ? '#34C759' : '#FF3B30';
  };

  const renderQuickAmounts = () => {
    const amounts = [25, 50, 100, 200];
    return (
      <View style={styles.quickAmountsContainer}>
        <Text style={styles.quickAmountsTitle}>Hızlı Seçim</Text>
        <View style={styles.quickAmountsRow}>
          {amounts.map((amount) => (
            <TouchableOpacity
              key={amount}
              style={styles.quickAmountButton}
              onPress={() => setAddAmount(amount.toString())}
            >
              <Text style={styles.quickAmountText}>₺{amount}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderTransactionCard = (transaction: Transaction) => (
    <View key={transaction.id} style={styles.transactionCard}>
      <View style={styles.transactionLeft}>
        <Ionicons
          name={getTransactionIcon(transaction.type)}
          size={24}
          color={getTransactionColor(transaction.type)}
        />
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDescription} numberOfLines={2}>
            {transaction.description}
          </Text>
          <Text style={styles.transactionDate}>
            {formatDate(transaction.created_at)}
          </Text>
        </View>
      </View>
      <Text
        style={[
          styles.transactionAmount,
          { color: getTransactionColor(transaction.type) },
        ]}
      >
        {transaction.type === 'credit' ? '+' : '-'}₺{transaction.amount.toFixed(2)}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cüzdan</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Mevcut Bakiye</Text>
          <Text style={styles.balanceAmount}>
            ₺{user?.wallet_balance?.toFixed(2) || '0.00'}
          </Text>
          <TouchableOpacity
            style={styles.addMoneyButton}
            onPress={() => setShowAddMoneyModal(true)}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addMoneyButtonText}>Para Ekle</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickActionCard}>
              <Ionicons name="card-outline" size={32} color="#007AFF" />
              <Text style={styles.quickActionText}>Kart Ekle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionCard}>
              <Ionicons name="receipt-outline" size={32} color="#007AFF" />
              <Text style={styles.quickActionText}>Faturalar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionCard}>
              <Ionicons name="gift-outline" size={32} color="#007AFF" />
              <Text style={styles.quickActionText}>Promosyonlar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transaction History */}
        <View style={styles.transactionsContainer}>
          <Text style={styles.sectionTitle}>İşlem Geçmişi</Text>
          {transactions.length > 0 ? (
            transactions.map(renderTransactionCard)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyStateText}>Henüz işlem bulunmuyor</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Money Modal */}
      <Modal
        visible={showAddMoneyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddMoneyModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddMoneyModal(false)}>
              <Text style={styles.modalCancelText}>İptal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Para Ekle</Text>
            <TouchableOpacity onPress={handleAddMoney}>
              <Text style={styles.modalDoneText}>Ekle</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Miktar (TL)</Text>
            <TextInput
              style={styles.amountInput}
              value={addAmount}
              onChangeText={setAddAmount}
              placeholder="0.00"
              keyboardType="numeric"
              autoFocus
            />

            {renderQuickAmounts()}

            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>• Minimum yükleme: 10 TL</Text>
              <Text style={styles.infoText}>• Maksimum yükleme: 1000 TL</Text>
              <Text style={styles.infoText}>• İşlem ücreti alınmaz</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
  },
  balanceCard: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  addMoneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addMoneyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
  },
  quickActionsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 12,
    color: '#1A1A1A',
    marginTop: 8,
    textAlign: 'center',
  },
  transactionsContainer: {
    marginBottom: 24,
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#FF3B30',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  modalDoneText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  amountInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  quickAmountsContainer: {
    marginBottom: 24,
  },
  quickAmountsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAmountButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  infoContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
});

export default WalletScreen;