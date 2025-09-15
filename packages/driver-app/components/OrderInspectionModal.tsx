import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_CONFIG } from '../config/api';

interface Customer {
  id: number;
  name: string;
  phone: string;
  pickup_location: string;
  destination: string;
  distance: string;
  estimated_fare: number;
  status: 'waiting' | 'accepted' | 'confirmed' | 'in_progress' | 'completed' | 'inspecting';
  created_at: string;
}

interface OrderDetails {
  customer_first_name?: string;
  customer_last_name?: string;
  customer_phone?: string;
  weight_kg?: number;
  labor_count?: number;
  cargo_photo_urls?: string;
}

interface OrderInspectionModalProps {
  visible: boolean;
  selectedOrder: Customer | null;
  orderDetails: OrderDetails | null;
  laborCount: string;
  laborPrice: number;
  onLaborCountChange: (count: string) => void;
  onClose: () => void;
  onAccept: (orderId: number, laborCount: number) => void;
  onOpenPhotoModal: (urls: string[], index: number) => void;
  styles: any;
}

const OrderInspectionModal: React.FC<OrderInspectionModalProps> = ({
  visible,
  selectedOrder,
  orderDetails,
  laborCount,
  laborPrice,
  onLaborCountChange,
  onClose,
  onAccept,
  onOpenPhotoModal,
  styles,
}) => {
  const maskPhoneNumber = (phone: string) => {
    if (!phone) return 'Bilinmiyor';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      return `${cleaned.slice(0, 3)}****${cleaned.slice(-3)}`;
    }
    return phone;
  };

  const makePhoneCall = (phoneNumber: string) => {
    const url = `tel:${phoneNumber}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        }
      })
      .catch((err) => console.error('Telefon araması başlatılamadı:', err));
  };

  const renderCargoPhotos = () => {
    if (!orderDetails?.cargo_photo_urls) return null;

    try {
      console.log('OrderInspectionModal - Raw cargo_photo_urls:', orderDetails.cargo_photo_urls);
      const photoUrls = typeof orderDetails.cargo_photo_urls === 'string' 
        ? JSON.parse(orderDetails.cargo_photo_urls) 
        : orderDetails.cargo_photo_urls;
      console.log('OrderInspectionModal - Parsed photoUrls:', photoUrls);
      
      if (Array.isArray(photoUrls)) {
        const processedUrls = photoUrls.map(url => {
          const trimmedUrl = url.trim();
          const finalUrl = trimmedUrl.startsWith('http') ? trimmedUrl : `${API_CONFIG.BASE_URL}${trimmedUrl}`;
          console.log('OrderInspectionModal - Final URL:', finalUrl);
          return finalUrl;
        });
        
        return processedUrls.map((url: string, index: number) => (
          <TouchableOpacity
            key={index}
            style={styles.photoThumbnail}
            onPress={() => onOpenPhotoModal(processedUrls, index)}
          >
            <Image
              source={{ uri: url }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ));
      } else if (typeof photoUrls === 'string') {
        const finalUrl = photoUrls.startsWith('http') ? photoUrls : `${API_CONFIG.BASE_URL}${photoUrls}`;
        console.log('OrderInspectionModal - Single URL:', finalUrl);
        return (
          <TouchableOpacity 
            style={styles.photoThumbnail}
            onPress={() => onOpenPhotoModal([finalUrl], 0)}
          >
            <Image
              source={{ uri: finalUrl }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        );
      }
      return null;
    } catch (error) {
      console.error('OrderInspectionModal - Fotoğraf URL parse hatası:', error);
      return null;
    }
  };

  const handleAccept = () => {
    if (selectedOrder) {
      const laborValue = laborCount && parseInt(laborCount) > 0 ? parseInt(laborCount) : 1;
      onAccept(selectedOrder.id, laborValue);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.inspectionModalContainer}>
          <View style={styles.inspectionModalHeader}>
            <Text style={styles.inspectionModalTitle}>Sipariş Detayları</Text>
          </View>
          
          <ScrollView style={styles.inspectionModalContent}>
            {selectedOrder && (
              <>
                <View style={styles.orderInfoSection}>
                  <Text style={styles.sectionTitle}>Müşteri Bilgileri</Text>
                  <View style={styles.infoRow}>
                    <Ionicons name="person" size={16} color="#6B7280" />
                    <Text style={styles.infoText}>
                      {orderDetails?.customer_first_name && orderDetails?.customer_last_name 
                        ? `${orderDetails.customer_first_name} ${orderDetails.customer_last_name}` 
                        : selectedOrder.name || 'Müşteri'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="call" size={16} color="#6B7280" />
                    <Text style={styles.infoText}>
                      {orderDetails?.customer_phone ? maskPhoneNumber(orderDetails.customer_phone) : 'Bilinmiyor'}
                    </Text>
                    {orderDetails?.customer_phone && (
                      <TouchableOpacity 
                        style={styles.callButton}
                        onPress={() => makePhoneCall(orderDetails.customer_phone!)}
                      >
                        <Ionicons name="call" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.orderInfoSection}>
                  <Text style={styles.sectionTitle}>Konum Bilgileri</Text>
                  <View style={styles.infoRow}>
                    <Ionicons name="location" size={16} color="#FFD700" />
                    <Text style={styles.infoText}>Alış: {selectedOrder.pickup_location}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="flag" size={16} color="#EF4444" />
                    <Text style={styles.infoText}>Varış: {selectedOrder.destination}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="map" size={16} color="#6B7280" />
                    <Text style={styles.infoText}>Mesafe: {selectedOrder.distance}</Text>
                  </View>
                </View>

                {orderDetails && (
                  <View style={styles.orderInfoSection}>
                    <Text style={styles.sectionTitle}>Yük Bilgileri</Text>
                    <View style={styles.infoRow}>
                      <Ionicons name="cube" size={16} color="#6B7280" />
                      <Text style={styles.infoText}>Ağırlık: {orderDetails.weight_kg} kg</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="people" size={16} color="#6B7280" />
                      <Text style={styles.infoText}>Hammal Sayısı:</Text>
                      <TextInput
                        style={styles.laborInput}
                        value={laborCount}
                        onChangeText={onLaborCountChange}
                        keyboardType="numeric"
                        placeholder={orderDetails?.labor_count?.toString() || "1"}
                      />
                    </View>
                  </View>
                )}

                {/* Cargo Photos */}
                {orderDetails && orderDetails.cargo_photo_urls && (
                  <View style={styles.orderInfoSection}>
                    <Text style={styles.sectionTitle}>Yükün Fotoğrafları</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
                      {renderCargoPhotos()}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.orderInfoSection}>
                  <Text style={styles.sectionTitle}>Fiyat Bilgileri</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Tahmini Ücret:</Text>
                    <Text style={styles.priceValue}>₺{selectedOrder.estimated_fare.toFixed(2)}</Text>
                  </View>
                  {laborCount && parseInt(laborCount) > 0 && (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Hammaliye:</Text>
                      <Text style={styles.priceValue}>₺{parseInt(laborCount) * laborPrice}</Text>
                    </View>
                  )}
                  <View style={[styles.priceRow, styles.totalPriceRow]}>
                    <Text style={styles.totalPriceLabel}>Toplam:</Text>
                    <Text style={styles.totalPriceValue}>
                      ₺{(selectedOrder.estimated_fare + (laborCount && parseInt(laborCount) > 0 ? parseInt(laborCount) * laborPrice : 0)).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
          
          <View style={styles.inspectionModalActions}>
            <TouchableOpacity
              style={[styles.modalActionButton, styles.cancelInspectionButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelInspectionButtonText}>İncelemeyi Bitir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionButton, styles.acceptInspectionButton]}
              onPress={handleAccept}
            >
              <Text style={styles.acceptInspectionButtonText}>Kabul Et</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default OrderInspectionModal;