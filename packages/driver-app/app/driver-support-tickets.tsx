import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SplashLoader from '../components/SplashLoader';
import { API_CONFIG } from '../config/api';

interface SupportTicket {
  id: number;
  issue_type: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  admin_response?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  tickets?: SupportTicket[];
  error?: string;
}

const DriverSupportTicketsPage = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return '#FF6B6B';
      case 'in_progress':
        return '#4ECDC4';
      case 'resolved':
        return '#45B7D1';
      case 'closed':
        return '#96CEB4';
      default:
        return '#BDC3C7';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open':
        return 'Açık';
      case 'in_progress':
        return 'İşlemde';
      case 'resolved':
        return 'Çözüldü';
      case 'closed':
        return 'Kapatıldı';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#E74C3C';
      case 'medium':
        return '#F39C12';
      case 'low':
        return '#27AE60';
      default:
        return '#BDC3C7';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Yüksek';
      case 'medium':
        return 'Orta';
      case 'low':
        return 'Düşük';
      default:
        return priority;
    }
  };

  const getIssueTypeText = (issueType: string) => {
    switch (issueType) {
      case 'technical':
        return 'Teknik Sorun';
      case 'payment':
        return 'Ödeme Sorunu';
      case 'order':
        return 'Sipariş Sorunu';
      case 'account':
        return 'Hesap Sorunu';
      case 'other':
        return 'Diğer';
      default:
        return issueType;
    }
  };

  const fetchSupportTickets = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Hata', 'Oturum açmanız gerekiyor');
        router.replace('/phone-auth');
        return;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/support-tickets`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data: ApiResponse = await response.json();

      if (data.success && data.tickets) {
        setTickets(data.tickets);
      } else {
        Alert.alert('Hata', data.error || 'Destek talepleri alınamadı');
      }
    } catch (error) {
      console.error('Destek talepleri getirme hatası:', error);
      Alert.alert('Hata', 'Bağlantı hatası oluştu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSupportTickets();
  };

  const openTicketDetails = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedTicket(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    fetchSupportTickets();
  }, []);

  const renderTicketItem = ({ item }: { item: SupportTicket }) => (
    <TouchableOpacity
      style={styles.ticketCard}
      onPress={() => openTicketDetails(item)}
    >
      <View style={styles.ticketHeader}>
        <View style={styles.ticketInfo}>
          <Text style={styles.ticketSubject} numberOfLines={1}>
            {item.subject}
          </Text>
          <Text style={styles.ticketType}>
            {getIssueTypeText(item.issue_type)}
          </Text>
        </View>
        <View style={styles.ticketBadges}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.badgeText}>{getStatusText(item.status)}</Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
            <Text style={styles.badgeText}>{getPriorityText(item.priority)}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.ticketMessage} numberOfLines={2}>
        {item.message}
      </Text>
      <View style={styles.ticketFooter}>
        <Text style={styles.ticketDate}>
          {formatDate(item.created_at)}
        </Text>
        {item.admin_response && (
          <View style={styles.responseIndicator}>
            <Ionicons name="chatbubble-ellipses" size={16} color="#4ECDC4" />
            <Text style={styles.responseText}>Yanıt var</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SplashLoader 
        visible={true} 
        text="Destek talepleri yükleniyor..." 
        logoSize={120} 
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Destek Taleplerim</Text>
      </View>

      {tickets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={80} color="#BDC3C7" />
          <Text style={styles.emptyTitle}>Henüz destek talebiniz yok</Text>
          <Text style={styles.emptySubtitle}>
            Yardım ve Destek bölümünden yeni bir talep oluşturabilirsiniz.
          </Text>
          <TouchableOpacity
            style={styles.createTicketButton}
            onPress={() => router.push('/driver-support')}
          >
            <Text style={styles.createTicketButtonText}>Destek Talebi Oluştur</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tickets}
          renderItem={renderTicketItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Ticket Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Talep Detayları</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedTicket && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Konu:</Text>
                  <Text style={styles.detailValue}>{selectedTicket.subject}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Sorun Türü:</Text>
                  <Text style={styles.detailValue}>
                    {getIssueTypeText(selectedTicket.issue_type)}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Durum:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedTicket.status) }]}>
                    <Text style={styles.badgeText}>{getStatusText(selectedTicket.status)}</Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Öncelik:</Text>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(selectedTicket.priority) }]}>
                    <Text style={styles.badgeText}>{getPriorityText(selectedTicket.priority)}</Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Mesajınız:</Text>
                  <Text style={styles.detailMessage}>{selectedTicket.message}</Text>
                </View>

                {selectedTicket.admin_response && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Admin Yanıtı:</Text>
                    <View style={styles.adminResponseContainer}>
                      <Text style={styles.adminResponse}>{selectedTicket.admin_response}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Oluşturulma Tarihi:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedTicket.created_at)}</Text>
                </View>

                {selectedTicket.resolved_at && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Çözülme Tarihi:</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedTicket.resolved_at)}</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 20,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ticketInfo: {
    flex: 1,
    marginRight: 10,
  },
  ticketSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  ticketType: {
    fontSize: 14,
    color: '#666',
  },
  ticketBadges: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ticketMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketDate: {
    fontSize: 12,
    color: '#999',
  },
  responseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  responseText: {
    fontSize: 12,
    color: '#4ECDC4',
    marginLeft: 4,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  createTicketButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createTicketButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  detailMessage: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  adminResponseContainer: {
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  adminResponse: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
});

export default DriverSupportTicketsPage;