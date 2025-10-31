import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_CONFIG } from '../config/api';
import { formatTurkishLira } from '../app/utils/currencyUtils';

interface Customer {
  id: number;
  name: string;
  phone: string;
  pickup_location: string;
  destination: string;
  distance: string;
  estimated_fare: number;
  status: 'pending' | 'waiting' | 'driver_accepted_awaiting_customer' | 'accepted' | 'confirmed' | 'in_progress' | 'completed' | 'inspecting' | 'rejected' | 'timeout';
  created_at: string;
  countdownTime?: number;
  countdownTotal?: number;
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
  isWaitingForCustomerApproval?: boolean;
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
  isWaitingForCustomerApproval = false,
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

  const processedPhotoUrls = useMemo(() => {
    if (!orderDetails?.cargo_photo_urls) return null;

    try {
      const photoUrls = typeof orderDetails.cargo_photo_urls === 'string' 
        ? JSON.parse(orderDetails.cargo_photo_urls) 
        : orderDetails.cargo_photo_urls;
      
      if (Array.isArray(photoUrls)) {
        return photoUrls.map(url => {
          const trimmedUrl = url.trim();
          return trimmedUrl.startsWith('http') ? trimmedUrl : `${API_CONFIG.BASE_URL}${trimmedUrl}`;
        });
      } else if (typeof photoUrls === 'string') {
        return [photoUrls.startsWith('http') ? photoUrls : `${API_CONFIG.BASE_URL}${photoUrls}`];
      }
      return null;
    } catch (error) {
      console.error('OrderInspectionModal - Fotoğraf URL parse hatası:', error);
      return null;
    }
  }, [orderDetails?.cargo_photo_urls]);

  const renderCargoPhotos = () => {
    if (!processedPhotoUrls) return null;

    return processedPhotoUrls.map((url: string, index: number) => (
      <TouchableOpacity
        key={index}
        style={styles.photoThumbnail}
        onPress={() => onOpenPhotoModal(processedPhotoUrls, index)}
      >
        <Image
          source={{ uri: url }}
          style={styles.thumbnailImage}
          resizeMode="cover"
        />
      </TouchableOpacity>
    ));
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
      onRequestClose={isWaitingForCustomerApproval ? undefined : onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={StyleSheet.absoluteFillObject} 
          activeOpacity={1} 
          onPress={isWaitingForCustomerApproval ? undefined : onClose}
        />
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
                    <Text style={styles.priceValue}>{formatTurkishLira(selectedOrder.estimated_fare)}</Text>
                  </View>
                  {laborCount && parseInt(laborCount) > 0 && (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Hammaliye:</Text>
                      <Text style={styles.priceValue}>{formatTurkishLira(parseInt(laborCount) * laborPrice)}</Text>
                    </View>
                  )}
                  <View style={[styles.priceRow, styles.totalPriceRow]}>
                    <Text style={styles.totalPriceLabel}>Toplam:</Text>
                    <Text style={styles.totalPriceValue}>
                      {formatTurkishLira(selectedOrder.estimated_fare + (laborCount && parseInt(laborCount) > 0 ? parseInt(laborCount) * laborPrice : 0))}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
          
          <View style={styles.inspectionModalActions}>
            <TouchableOpacity
              style={[styles.modalActionButton, styles.cancelInspectionButton, isWaitingForCustomerApproval && styles.disabledButton]}
              onPress={isWaitingForCustomerApproval ? undefined : onClose}
              disabled={isWaitingForCustomerApproval}
            >
              <Text style={[styles.cancelInspectionButtonText, isWaitingForCustomerApproval && styles.disabledButtonText]}>
                İncelemeyi Bitir
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionButton, styles.acceptInspectionButton, isWaitingForCustomerApproval && styles.disabledButton]}
              onPress={handleAccept}
              disabled={isWaitingForCustomerApproval}
            >
              <Text style={[styles.acceptInspectionButtonText, isWaitingForCustomerApproval && styles.disabledButtonText]}>
                {isWaitingForCustomerApproval ? 'Onay Bekleniyor...' : 'Kabul Et'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default OrderInspectionModal;