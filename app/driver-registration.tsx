import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import LoadingIndicator from '../components/LoadingIndicator';

interface DriverFormData {
  tc_number: string;
  first_name: string;
  last_name: string;
  email: string;
  tax_number: string;
  tax_office: string;
  license_number: string;
  license_expiry_date: string;
  vehicle_type: string;
  vehicle_plate: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_year: string;
  driver_photo: any;
  license_photo: any;
  eligibility_certificate: any;
}

export default function DriverRegistrationScreen() {
  const { showModal, token } = useAuth();
  const [formData, setFormData] = useState<DriverFormData>({
    tc_number: '',
    first_name: '',
    last_name: '',
    email: '',
    tax_number: '',
    tax_office: '',
    license_number: '',
    license_expiry_date: '',
    vehicle_type: 'sedan',
    vehicle_plate: '',
    vehicle_model: '',
    vehicle_color: '',
    vehicle_year: '',
    driver_photo: null,
    license_photo: null,
    eligibility_certificate: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const updateFormData = (field: keyof DriverFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const pickDocument = async (field: 'driver_photo' | 'license_photo' | 'eligibility_certificate') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setFormData(prev => ({ ...prev, [field]: result.assets[0] }));
      }
    } catch (error) {
      showModal('Hata', 'Dosya seçilirken bir hata oluştu.', 'error');
    }
  };

  const handleSubmit = async () => {
    // Form validasyonu
    const requiredFields = [
      'tc_number', 'first_name', 'last_name', 'email', 'tax_number', 
      'tax_office', 'license_number', 'license_expiry_date', 'vehicle_plate', 
      'vehicle_model', 'vehicle_color', 'vehicle_year'
    ];

    for (const field of requiredFields) {
      if (!formData[field as keyof DriverFormData]) {
        showModal('Hata', 'Lütfen tüm zorunlu alanları doldurun.', 'error');
        return;
      }
    }

    if (!formData.driver_photo || !formData.license_photo || !formData.eligibility_certificate) {
      showModal('Hata', 'Lütfen tüm belgeleri yükleyin.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      
      // Form verilerini ekle
      Object.keys(formData).forEach(key => {
        if (key.includes('_photo') || key.includes('_certificate')) {
          const file = formData[key as keyof DriverFormData];
          if (file) {
            formDataToSend.append(key, {
              uri: file.uri,
              type: file.mimeType || 'image/jpeg',
              name: file.name || `${key}.jpg`,
            } as any);
          }
        } else {
          formDataToSend.append(key, formData[key as keyof DriverFormData] as string);
        }
      });

      const response = await fetch('http://192.168.1.134:3001/api/drivers/register', {
        method: 'POST',
        body: formDataToSend,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        showModal(
          'Başvuru Tamamlandı',
          'Sürücü başvurunuz başarıyla alındı. Onay sürecini takip edebilirsiniz.',
          'success',
          [{ text: 'Tamam', onPress: () => router.replace('/driver-status') }]
        );
      } else {
        showModal('Hata', result.message || 'Başvuru gönderilirken bir hata oluştu.', 'error');
      }
    } catch (error) {
      showModal('Hata', 'Başvuru gönderilirken bir hata oluştu.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Kişisel Bilgiler</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>TC Kimlik No *</Text>
        <TextInput
          style={styles.input}
          value={formData.tc_number}
          onChangeText={(text) => updateFormData('tc_number', text)}
          placeholder="TC Kimlik numaranızı girin"
          keyboardType="numeric"
          maxLength={11}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Ad *</Text>
          <TextInput
            style={styles.input}
            value={formData.first_name}
            onChangeText={(text) => updateFormData('first_name', text)}
            placeholder="Adınız"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Soyad *</Text>
          <TextInput
            style={styles.input}
            value={formData.last_name}
            onChangeText={(text) => updateFormData('last_name', text)}
            placeholder="Soyadınız"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>E-posta *</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(text) => updateFormData('email', text)}
          placeholder="E-posta adresiniz"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Vergi No *</Text>
          <TextInput
            style={styles.input}
            value={formData.tax_number}
            onChangeText={(text) => updateFormData('tax_number', text)}
            placeholder="Vergi numaranız"
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Vergi Dairesi *</Text>
          <TextInput
            style={styles.input}
            value={formData.tax_office}
            onChangeText={(text) => updateFormData('tax_office', text)}
            placeholder="Vergi dairesi"
          />
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Ehliyet Bilgileri</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Ehliyet No *</Text>
        <TextInput
          style={styles.input}
          value={formData.license_number}
          onChangeText={(text) => updateFormData('license_number', text)}
          placeholder="Ehliyet numaranız"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Ehliyet Son Geçerlilik Tarihi *</Text>
        <TextInput
          style={styles.input}
          value={formData.license_expiry_date}
          onChangeText={(text) => updateFormData('license_expiry_date', text)}
          placeholder="GG/AA/YYYY"
        />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Araç Bilgileri</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Araç Tipi *</Text>
        <View style={styles.vehicleTypeContainer}>
          {['sedan', 'pickup', 'van', 'truck'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.vehicleTypeButton,
                formData.vehicle_type === type && styles.vehicleTypeButtonActive
              ]}
              onPress={() => updateFormData('vehicle_type', type)}
            >
              <Text style={[
                styles.vehicleTypeText,
                formData.vehicle_type === type && styles.vehicleTypeTextActive
              ]}>
                {type === 'sedan' ? 'Sedan' : 
                 type === 'pickup' ? 'Pickup' :
                 type === 'van' ? 'Van' : 'Kamyon'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Plaka *</Text>
        <TextInput
          style={styles.input}
          value={formData.vehicle_plate}
          onChangeText={(text) => updateFormData('vehicle_plate', text.toUpperCase())}
          placeholder="34ABC123"
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Araç Modeli *</Text>
        <TextInput
          style={styles.input}
          value={formData.vehicle_model}
          onChangeText={(text) => updateFormData('vehicle_model', text)}
          placeholder="Örn: Ford Transit"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Renk *</Text>
          <TextInput
            style={styles.input}
            value={formData.vehicle_color}
            onChangeText={(text) => updateFormData('vehicle_color', text)}
            placeholder="Beyaz"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Model Yılı *</Text>
          <TextInput
            style={styles.input}
            value={formData.vehicle_year}
            onChangeText={(text) => updateFormData('vehicle_year', text)}
            placeholder="2020"
            keyboardType="numeric"
            maxLength={4}
          />
        </View>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Belgeler</Text>
      
      <View style={styles.documentSection}>
        <TouchableOpacity 
          style={styles.documentButton}
          onPress={() => pickDocument('driver_photo')}
        >
          <Ionicons name="camera" size={24} color="#FCD34D" />
          <Text style={styles.documentButtonText}>
            {formData.driver_photo ? 'Sürücü Fotoğrafı ✓' : 'Sürücü Fotoğrafı Yükle *'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.documentButton}
          onPress={() => pickDocument('license_photo')}
        >
          <Ionicons name="card" size={24} color="#FCD34D" />
          <Text style={styles.documentButtonText}>
            {formData.license_photo ? 'Ehliyet Fotoğrafı ✓' : 'Ehliyet Fotoğrafı Yükle *'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.documentButton}
          onPress={() => pickDocument('eligibility_certificate')}
        >
          <Ionicons name="document" size={24} color="#FCD34D" />
          <Text style={styles.documentButtonText}>
            {formData.eligibility_certificate ? 'Yeterlilik Belgesi ✓' : 'Yeterlilik Belgesi Yükle *'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sürücü Başvurusu</Text>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>{currentStep}/4</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </ScrollView>

      <View style={styles.footer}>
        {currentStep < 4 ? (
          <TouchableOpacity 
            style={styles.nextButton}
            onPress={() => setCurrentStep(currentStep + 1)}
          >
            <Text style={styles.nextButtonText}>Devam Et</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Text style={styles.submitButtonText}>
              Başvuruyu Tamamla
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      <LoadingIndicator 
        visible={isLoading} 
        text="Başvuru gönderiliyor..." 
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  stepIndicator: {
    backgroundColor: '#FCD34D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  stepText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    paddingVertical: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  row: {
    flexDirection: 'row',
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  vehicleTypeButtonActive: {
    borderColor: '#FCD34D',
    backgroundColor: '#FEF3C7',
  },
  vehicleTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  vehicleTypeTextActive: {
    color: '#000000',
  },
  documentSection: {
    gap: 16,
  },
  documentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    gap: 12,
  },
  documentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    backgroundColor: '#FCD34D',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});