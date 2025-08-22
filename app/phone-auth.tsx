import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import LoadingIndicator from '../components/LoadingIndicator';

export default function PhoneAuthScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userType, setUserType] = useState<'customer' | 'driver'>('customer');
  const { sendSMS, showModal } = useAuth();

  const validatePhoneAuth = () => {
    // Kullanıcı tipi seçimi kontrolü
    if (!userType) {
      showModal('Hata', 'Lütfen kullanıcı tipini seçin.', 'error');
      return false;
    }
    
    // Telefon numarası kontrolü
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    
    if (!cleanedPhone.trim()) {
      showModal('Hata', 'Lütfen telefon numaranızı girin.', 'error');
      return false;
    }
    
    if (cleanedPhone.length !== 10) {
      showModal('Hata', 'Telefon numarası 10 haneli olmalıdır.', 'error');
      return false;
    }
    
    // Türkiye cep telefonu formatı kontrolü (5XX ile başlamalı)
    if (!cleanedPhone.startsWith('5')) {
      showModal('Hata', 'Lütfen geçerli bir cep telefonu numarası girin.', 'error');
      return false;
    }
    
    return true;
  };

  const handleSendCode = async () => {
    if (!validatePhoneAuth()) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Telefon numarasını temizle ve formatla
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      
      // SMS gönder
      const success = await sendSMS(cleanedPhone);
      
      if (success) {
        // Telefon numarasını ve kullanıcı tipini verify-code ekranına aktar
        router.push({
          pathname: '/verify-code',
          params: { phoneNumber: cleanedPhone, userType }
        });
      }
      // SMS gönderme başarısız olursa burada bir şey yapmaya gerek yok
      // çünkü sendSMS fonksiyonu zaten hata mesajını gösteriyor
    } catch (error) {
      console.error('Phone auth error:', error);
      showModal('Hata', 'SMS gönderilirken beklenmeyen bir hata oluştu.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (text: string) => {
    // Sadece rakamları al
    const cleaned = text.replace(/\D/g, '');
    
    // Türkiye telefon formatı: (5XX) XXX XX XX
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else if (cleaned.length <= 8) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`;
    }
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="call" size={48} color="#FCD34D" />
        </View>
        
        <Text style={styles.title}>Telefon Numaranız</Text>
        <Text style={styles.subtitle}>
          Size SMS ile doğrulama kodu göndereceğiz
        </Text>

        {/* Kullanıcı Tipi Seçimi */}
        <View style={styles.userTypeContainer}>
          <TouchableOpacity 
            style={[styles.userTypeButton, userType === 'customer' && styles.userTypeButtonActive]}
            onPress={() => setUserType('customer')}
          >
            <Ionicons 
              name="person" 
              size={24} 
              color={userType === 'customer' ? '#FCD34D' : '#6B7280'} 
            />
            <Text style={[styles.userTypeText, userType === 'customer' && styles.userTypeTextActive]}>
              Müşteri
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.userTypeButton, userType === 'driver' && styles.userTypeButtonActive]}
            onPress={() => setUserType('driver')}
          >
            <Ionicons 
              name="car" 
              size={24} 
              color={userType === 'driver' ? '#FCD34D' : '#6B7280'} 
            />
            <Text style={[styles.userTypeText, userType === 'driver' && styles.userTypeTextActive]}>
              Sürücü
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.countryCode}>+90</Text>
          <TextInput
            style={styles.phoneInput}
            value={phoneNumber}
            onChangeText={handlePhoneChange}
            placeholder="(5XX) XXX XX XX"
            keyboardType="phone-pad"
            maxLength={17}
            autoFocus
          />
        </View>

        <TouchableOpacity 
          style={[styles.continueButton, phoneNumber.length < 10 && styles.continueButtonDisabled]}
          onPress={handleSendCode}
          disabled={phoneNumber.length < 10 || isLoading}
        >
          <Text style={styles.continueButtonText}>
            Devam Et
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Devam ederek Kullanım Şartları ve Gizlilik Politikası'nı kabul etmiş olursunuz.
        </Text>
      </View>
      
      <LoadingIndicator 
        visible={isLoading} 
        text="SMS gönderiliyor..." 
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 32,
    backgroundColor: '#F9FAFB',
  },
  countryCode: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginRight: 12,
  },
  phoneInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: '#000000',
    paddingVertical: 16,
  },
  continueButton: {
    backgroundColor: '#FCD34D',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#FCD34D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  continueButtonDisabled: {
    backgroundColor: '#E5E7EB',
    elevation: 0,
    shadowOpacity: 0,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  disclaimer: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  userTypeContainer: {
    flexDirection: 'row',
    marginBottom: 32,
    gap: 12,
  },
  userTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  userTypeButtonActive: {
    borderColor: '#FCD34D',
    backgroundColor: '#FEF3C7',
  },
  userTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  userTypeTextActive: {
    color: '#000000',
  },
});