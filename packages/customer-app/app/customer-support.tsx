import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';
import BackButton from '../components/BackButton';
import SafeModal from '../components/SafeModal';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface SupportCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
  action: () => void;
}

export default function CustomerSupportScreen() {
  const { user, showModal } = useAuth();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [supportMessage, setSupportMessage] = useState('');
  const [selectedIssueType, setSelectedIssueType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const faqData: FAQItem[] = [
    {
      id: '1',
      question: 'Nasıl sipariş verebilirim?',
      answer: 'Ana ekranda haritadan başlangıç ve bitiş noktalarını seçin, kargo türünü belirleyin ve "Sipariş Ver" butonuna dokunun.',
      category: 'orders'
    },
    {
      id: '2',
      question: 'Ödeme nasıl yapılır?',
      answer: 'Nakit veya kredi kartı ile ödeme yapabilirsiniz. Kart bilgilerinizi güvenli bir şekilde kaydedebilir ve hızlı ödeme yapabilirsiniz.',
      category: 'payments'
    },
    {
      id: '3',
      question: 'Siparişimi nasıl takip edebilirim?',
      answer: 'Sipariş verdikten sonra haritada sürücünüzün konumunu canlı olarak takip edebilirsiniz. Ayrıca "Taşımalarım" bölümünden geçmiş siparişlerinizi görüntüleyebilirsiniz.',
      category: 'tracking'
    },
    {
      id: '4',
      question: 'Siparişimi iptal edebilir miyim?',
      answer: 'Sürücü henüz yola çıkmamışsa siparişinizi ücretsiz iptal edebilirsiniz. Sürücü yola çıktıktan sonra iptal ücreti uygulanabilir.',
      category: 'orders'
    },
    {
      id: '5',
      question: 'Kargo ücretleri nasıl hesaplanır?',
      answer: 'Ücretler mesafe, kargo türü ve yoğunluk durumuna göre hesaplanır. Sipariş vermeden önce tahmini ücreti görebilirsiniz.',
      category: 'pricing'
    },
    {
      id: '6',
      question: 'Hangi tür kargolar gönderilebilir?',
      answer: 'Evrak, paket, yemek ve diğer küçük eşyalar gönderilebilir. Tehlikeli maddeler, kırılgan eşyalar için özel paketleme gerekebilir.',
      category: 'cargo'
    },
    {
      id: '7',
      question: 'Sürücü ile nasıl iletişim kurarım?',
      answer: 'Sipariş detaylarında sürücünün telefon numarası görünür. Arama butonu ile direkt arayabilir veya mesaj gönderebilirsiniz.',
      category: 'communication'
    },
    {
      id: '8',
      question: 'Hesabım ile ilgili sorun yaşıyorum',
      answer: 'Hesap sorunları için "Ayarlar" > "Hesap Detayları" bölümünden bilgilerinizi güncelleyebilir veya destek ekibimizle iletişime geçebilirsiniz.',
      category: 'account'
    }
  ];

  const supportCategories: SupportCategory[] = [
    {
      id: 'live-chat',
      title: 'Canlı Destek',
      icon: 'chatbubbles',
      description: 'Destek ekibimizle anında konuşun',
      action: () => {
        showModal(
          'Canlı Destek',
          'Canlı destek özelliği yakında aktif olacak. Şimdilik telefon veya e-posta ile iletişime geçebilirsiniz.',
          'info',
          [{ text: 'Tamam' }]
        );
      }
    },
    {
      id: 'phone',
      title: 'Telefon Desteği',
      icon: 'call',
      description: '7/24 telefon desteği',
      action: () => {
        showModal(
          'Telefon Desteği',
          'Destek hattımızı aramak istediğinizden emin misiniz?',
          'info',
          [
            { text: 'İptal', style: 'cancel' },
            { text: 'Ara', onPress: () => Linking.openURL('tel:+905001234567') }
          ]
        );
      }
    },
    {
      id: 'email',
      title: 'E-posta Desteği',
      icon: 'mail',
      description: 'E-posta ile destek talebi oluşturun',
      action: () => {
        Linking.openURL('mailto:support@yuklegeltaksi.com?subject=Müşteri Destek Talebi');
      }
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp Desteği',
      icon: 'logo-whatsapp',
      description: 'WhatsApp üzerinden hızlı destek',
      action: () => {
        Linking.openURL('https://wa.me/905001234567?text=Merhaba, YükleGel Taksi uygulaması hakkında yardıma ihtiyacım var.');
      }
    }
  ];

  const issueTypes = [
    { id: 'order', title: 'Sipariş Sorunu' },
    { id: 'payment', title: 'Ödeme Sorunu' },
    { id: 'technical', title: 'Teknik Sorun' },
    { id: 'account', title: 'Hesap Sorunu' },
    { id: 'refund', title: 'İade Talebi' },
    { id: 'other', title: 'Diğer' }
  ];

  const categories = [
    { id: 'all', title: 'Tümü' },
    { id: 'orders', title: 'Siparişler' },
    { id: 'payments', title: 'Ödemeler' },
    { id: 'tracking', title: 'Takip' },
    { id: 'pricing', title: 'Ücretler' },
    { id: 'cargo', title: 'Kargo' },
    { id: 'account', title: 'Hesap' },
    { id: 'technical', title: 'Teknik' }
  ];

  const filteredFAQs = faqData.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSendSupportMessage = async () => {
    if (!selectedIssueType || !supportMessage.trim()) {
      showModal('Hata', 'Lütfen sorun türünü seçin ve mesajınızı yazın.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        showModal('Hata', 'Oturum bilgisi bulunamadı', 'error');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/customer-support-tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          issue_type: selectedIssueType,
          subject: `${selectedIssueType.charAt(0).toUpperCase() + selectedIssueType.slice(1)} Sorunu`,
          message: supportMessage.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showModal(
          'Destek Talebi Gönderildi',
          'Destek talebiniz başarıyla gönderildi. En kısa sürede size dönüş yapacağız.',
          'success',
          [
            {
              text: 'Tamam',
              onPress: () => {
                setSupportMessage('');
                setSelectedIssueType('');
              }
            }
          ]
        );
      } else {
        showModal('Hata', result.error || 'Destek talebi gönderilemedi', 'error');
      }
    } catch (error) {
      console.error('Destek talebi gönderme hatası:', error);
      showModal('Hata', 'Destek talebi gönderilirken bir hata oluştu', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFAQItem = (item: FAQItem) => {
    const isExpanded = expandedFAQ === item.id;
    
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.faqItem}
        onPress={() => setExpandedFAQ(isExpanded ? null : item.id)}
      >
        <View style={styles.faqHeader}>
          <Text style={styles.faqQuestion}>{item.question}</Text>
          <Ionicons 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color="#6B7280" 
          />
        </View>
        {isExpanded && (
          <Text style={styles.faqAnswer}>{item.answer}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderSupportCategory = (category: SupportCategory) => (
    <TouchableOpacity
      key={category.id}
      style={styles.supportCategoryItem}
      onPress={category.action}
    >
      <View style={styles.supportCategoryIcon}>
        <Ionicons name={category.icon as any} size={24} color="#FFD700" />
      </View>
      <View style={styles.supportCategoryContent}>
        <Text style={styles.supportCategoryTitle}>{category.title}</Text>
        <Text style={styles.supportCategoryDescription}>{category.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Destek</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Support Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hızlı Destek</Text>
          {supportCategories.map(renderSupportCategory)}
        </View>

        {/* Support Request Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Destek Talebi Oluştur</Text>
          
          <View style={styles.formContainer}>
            <Text style={styles.formLabel}>Sorun Türü</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.issueTypeContainer}>
              {issueTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.issueTypeChip,
                    selectedIssueType === type.id && styles.issueTypeChipSelected
                  ]}
                  onPress={() => setSelectedIssueType(type.id)}
                >
                  <Text style={[
                    styles.issueTypeText,
                    selectedIssueType === type.id && styles.issueTypeTextSelected
                  ]}>
                    {type.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.formLabel}>Mesajınız</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Sorununuzu detaylı olarak açıklayın..."
              value={supportMessage}
              onChangeText={setSupportMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.sendButton, isSubmitting && styles.sendButtonDisabled]}
              onPress={handleSendSupportMessage}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFFFFF" />
              )}
              <Text style={styles.sendButtonText}>
                {isSubmitting ? 'Gönderiliyor...' : 'Gönder'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sık Sorulan Sorular</Text>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Sorularınızı arayın..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Category Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryContainer}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === category.id && styles.categoryChipSelected
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Text style={[
                  styles.categoryText,
                  selectedCategory === category.id && styles.categoryTextSelected
                ]}>
                  {category.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* FAQ Items */}
          <View style={styles.faqContainer}>
            {filteredFAQs.length > 0 ? (
              filteredFAQs.map(renderFAQItem)
            ) : (
              <View style={styles.noResultsContainer}>
                <Ionicons name="search" size={48} color="#D1D5DB" />
                <Text style={styles.noResultsText}>Aradığınız kriterlere uygun soru bulunamadı</Text>
                <Text style={styles.noResultsSubtext}>Farklı anahtar kelimeler deneyin veya kategori filtrelerini değiştirin</Text>
              </View>
            )}
          </View>
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İletişim Bilgileri</Text>
          <View style={styles.contactContainer}>
            <View style={styles.contactItem}>
              <Ionicons name="call" size={20} color="#FFD700" />
              <Text style={styles.contactText}>+90 500 123 45 67</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="mail" size={20} color="#FFD700" />
              <Text style={styles.contactText}>support@yuklegeltaksi.com</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="time" size={20} color="#FFD700" />
              <Text style={styles.contactText}>7/24 Destek Hizmeti</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  supportCategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  supportCategoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  supportCategoryContent: {
    flex: 1,
  },
  supportCategoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  supportCategoryDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  issueTypeContainer: {
    marginBottom: 20,
  },
  issueTypeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  issueTypeChipSelected: {
    backgroundColor: '#FFD700',
  },
  issueTypeText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  issueTypeTextSelected: {
    color: '#FFFFFF',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    minHeight: 100,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    borderRadius: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    marginLeft: 8,
  },
  categoryContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#FFD700',
  },
  categoryText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  faqContainer: {
    marginHorizontal: 20,
  },
  faqItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginRight: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  contactContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contactText: {
    fontSize: 16,
    color: '#000000',
    marginLeft: 12,
  },
});