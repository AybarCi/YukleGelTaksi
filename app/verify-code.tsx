import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoadingIndicator from '../components/LoadingIndicator';

export default function VerifyCodeScreen() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const inputRefs = useRef<TextInput[]>([]);
  const { phoneNumber, userType } = useLocalSearchParams<{ phoneNumber: string; userType: string }>();
  const { verifySMS, sendSMS, showModal, token, logout } = useAuth();

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Otomatik olarak sonraki input'a geç
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Kod tamamlandığında otomatik doğrula
    if (newCode.every(digit => digit !== '') && newCode.join('').length === 6) {
      handleVerifyCode(newCode.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const validateVerificationCode = (codeToVerify: string) => {
    if (codeToVerify.length !== 6) {
      showModal('Hata', 'Lütfen 6 haneli doğrulama kodunu girin.', 'error');
      return false;
    }
    
    // Sadece rakam kontrolü
    if (!/^[0-9]+$/.test(codeToVerify)) {
      showModal('Hata', 'Doğrulama kodu sadece rakamlardan oluşmalıdır.', 'error');
      return false;
    }
    
    return true;
  };

  const handleVerifyCode = async (verificationCode?: string) => {
    const codeToVerify = verificationCode || code.join('');
    
    if (!validateVerificationCode(codeToVerify)) {
      return;
    }

    if (!phoneNumber) {
      showModal('Hata', 'Telefon numarası bulunamadı.', 'error');
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await verifySMS(phoneNumber, codeToVerify, userType);
      
      if (result.success) {
        // Telefon numarasını AsyncStorage'a kaydet
        await AsyncStorage.setItem('phoneNumber', phoneNumber);
        
        // Doğrulama başarılı - kullanıcı tipine göre yönlendir
        if (userType === 'driver') {
          // Sürücü için önce durumunu kontrol et
          try {
            const response = await fetch(`http://192.168.1.12:3001/api/drivers/status`, {
              headers: {
                'Authorization': `Bearer ${result.token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              // Sürücü kaydı var, durum ekranına yönlendir
              router.replace('/driver-status');
            } else if (response.status === 404) {
              // Sürücü kaydı yok, kayıt ekranına yönlendir
              router.replace('/driver-registration');
            } else {
              showModal('Hata', 'Durum kontrol edilirken hata oluştu.', 'error');
            }
          } catch (error) {
            console.log('Error checking driver status:', error);
            // Network error - logout user and redirect to login
            await logout();
            router.replace('/phone-auth');
          }
        } else {
          router.replace('/home');
        }
      } else {
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      showModal('Hata', 'Doğrulama kodu yanlış. Lütfen tekrar deneyin.', 'error');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!phoneNumber) {
      showModal('Hata', 'Telefon numarası bulunamadı.', 'error');
      return;
    }

    try {
      const success = await sendSMS(phoneNumber);
      if (success) {
        setTimer(60);
        showModal('Başarılı', 'Doğrulama kodu yeniden gönderildi.', 'success');
      }
    } catch (error) {
      showModal('Hata', 'SMS gönderilirken bir hata oluştu.', 'error');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="chatbubble" size={48} color="#FCD34D" />
        </View>
        
        <Text style={styles.title}>Doğrulama Kodu</Text>
        <Text style={styles.subtitle}>
          Telefon numaranıza gönderilen 6 haneli kodu girin
        </Text>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                if (ref) inputRefs.current[index] = ref;
              }}
              style={[
                styles.codeInput,
                digit && styles.codeInputFilled
              ]}
              value={digit}
              onChangeText={(text) => handleCodeChange(text, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={index === 0}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity 
          style={[styles.continueButton, code.join('').length !== 6 && styles.continueButtonDisabled]}
          onPress={() => handleVerifyCode()}
          disabled={code.join('').length !== 6 || isLoading}
        >
          <Text style={styles.continueButtonText}>
            Doğrula
          </Text>
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          {timer > 0 ? (
            <Text style={styles.timerText}>
              Yeniden gönder ({timer}s)
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResendCode}>
              <Text style={styles.resendText}>Kodu Yeniden Gönder</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <LoadingIndicator 
        visible={isLoading} 
        text="Doğrulama kodu kontrol ediliyor..." 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
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
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    backgroundColor: '#F9FAFB',
  },
  codeInputFilled: {
    borderColor: '#FCD34D',
    backgroundColor: '#FEF3C7',
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
  resendContainer: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  resendText: {
    fontSize: 16,
    color: '#FCD34D',
    fontWeight: '600',
  },
});