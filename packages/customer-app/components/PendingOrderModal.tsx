import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Order {
  id: number;
  status: string;
  pickup_address: string;
  destination_address: string;
  distance_km?: number;
  total_price?: number;
  cargo_photo_urls?: string;
}

interface PendingOrderModalProps {
  visible: boolean;
  onClose: () => void;
  currentOrder: Order | null;
  onConfirm: () => void;
  getOrderStatusText: (status: string) => string;
}

const PendingOrderModal: React.FC<PendingOrderModalProps> = ({
  visible,
  onClose,
  currentOrder,
  onConfirm,
  getOrderStatusText,
}) => {
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
          maxHeight: '70%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name="information-circle" size={24} color="#F59E0B" />
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 8, color: '#1F2937' }}>
              Devam Eden Sipariş
            </Text>
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 16, marginBottom: 16, color: '#6B7280', lineHeight: 22 }}>
              Devam eden bir siparişiniz bulundu. Sipariş detaylarını aşağıda görebilirsiniz:
            </Text>
            
            {currentOrder && (
              <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Durum</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: currentOrder.status === 'pending' ? '#F59E0B' : 
                                     currentOrder.status === 'accepted' ? '#10B981' : '#3B82F6',
                      marginRight: 8
                    }} />
                    <Text style={{ fontSize: 14, color: '#1F2937', fontWeight: '500' }}>
                      {getOrderStatusText(currentOrder.status)}
                    </Text>
                  </View>
                </View>
                
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Alış Noktası</Text>
                  <Text style={{ fontSize: 14, color: '#1F2937' }}>{currentOrder.pickup_address}</Text>
                </View>
                
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Varış Noktası</Text>
                  <Text style={{ fontSize: 14, color: '#1F2937' }}>{currentOrder.destination_address}</Text>
                </View>
                
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Mesafe</Text>
                  <Text style={{ fontSize: 14, color: '#1F2937' }}>{currentOrder.distance_km ? currentOrder.distance_km.toFixed(1) : 'Hesaplanıyor'} km</Text>
                </View>
                
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Toplam Tutar</Text>
                  <Text style={{ fontSize: 16, color: '#059669', fontWeight: 'bold' }}>
                    ₺{currentOrder.total_price ? currentOrder.total_price.toFixed(2) : 'Hesaplanıyor'}
                  </Text>
                </View>
                
                {currentOrder.cargo_photo_urls && (
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Yük Fotoğrafları</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                      {(JSON.parse(currentOrder.cargo_photo_urls) as string[]).map((imageUri: string, index: number) => (
                        <View key={index} style={{ marginRight: 8 }}>
                          <Image
                            source={{ uri: imageUri }}
                            style={{
                              width: 80,
                              height: 80,
                              borderRadius: 8,
                              backgroundColor: '#F3F4F6'
                            }}
                            resizeMode="cover"
                          />
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}
            
            <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 20, lineHeight: 20 }}>
              Sipariş bilgileriniz form alanlarına getirilecektir.
            </Text>
          </ScrollView>
          
          <View style={{ marginTop: 16 }}>
            <TouchableOpacity
              style={{
                backgroundColor: '#F59E0B',
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 8,
                width: '100%'
              }}
              onPress={onConfirm}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default PendingOrderModal;