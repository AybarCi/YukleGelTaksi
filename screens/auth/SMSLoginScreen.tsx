import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type SMSLoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SMSLogin'>;

interface Props {
  navigation: SMSLoginScreenNavigationProp;
}

const SMSLoginScreen: React.FC<Props> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { sendSMS } = useAuth();

  const handleSendSMS = async () => {
    if (!phone.trim()) {
      Alert.alert('Hata', 'Lütfen telefon numaranızı girin');
      return;
    }

    if (phone.length < 10 || phone.length > 11) {
      Alert.alert('Hata', 'Geçerli bir telefon numarası girin');
      return;
    }

    setIsLoading(true);
    const success = await sendSMS(phone);
    setIsLoading(false);

    if (success) {
      navigation.navigate('SMSVerification', { phone });
    }
  };

  const formatPhoneNumber = (text: string) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    
    // Limit to 11 digits
    const limited = cleaned.slice(0, 11);
    
    setPhone(limited);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>SMS ile Giriş</Text>
              <Text style={styles.subtitle}>
                Telefon numaranızı girin, size doğrulama kodu gönderelim
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Telefon Numarası</Text>
                <TextInput
                  style={styles.input}
                  placeholder="5XXXXXXXXX"
                  value={phone}
                  onChangeText={formatPhoneNumber}
                  keyboardType="phone-pad"
                  maxLength={11}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.sendButton, isLoading && styles.disabledButton]}
                onPress={handleSendSMS}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.sendButtonText}>Doğrulama Kodu Gönder</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>
                📱 Size SMS ile 6 haneli bir doğrulama kodu göndereceğiz
              </Text>
              <Text style={styles.infoText}>
                ⏱️ Kod 10 dakika geçerli olacak
              </Text>
              <Text style={styles.infoText}>
                🔒 Telefon numaranız güvenli bir şekilde saklanır
              </Text>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.backText}>← Şifre ile giriş yap</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#1A1A1A',
    textAlign: 'center',
    letterSpacing: 1,
  },
  sendButton: {
    height: 52,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    marginBottom: 8,
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
});

export default SMSLoginScreen;