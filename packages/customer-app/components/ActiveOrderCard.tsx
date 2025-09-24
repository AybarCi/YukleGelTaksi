import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Order {
  id?: string;
  status?: string;
  pickupAddress?: string;
  destinationAddress?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  destinationLatitude?: number;
  destinationLongitude?: number;
  vehicleTypeId?: string | number;
  vehicle_type_id?: string | number;
  createdAt?: string;
  estimatedPrice?: number;
  distance?: number;
  estimatedTime?: number;
  notes?: string;
  laborRequired?: boolean;
  laborCount?: number;
  weight_kg?: number;
  cargoImages?: string[];
  driver_id?: string;
  driver_name?: string;
  driver_latitude?: number;
  driver_longitude?: number;
  driver_heading?: number;
}

interface ActiveOrderCardProps {
  order: Order;
  vehicleTypes?: any[];
}

const ActiveOrderCard: React.FC<ActiveOrderCardProps> = ({ 
  order, 
  vehicleTypes = []
}) => {
  console.log('🔴 ActiveOrderCard render başladı:', {
    order,
    vehicleTypes,
    orderKeys: order ? Object.keys(order) : 'order null',
    vehicleTypesLength: vehicleTypes?.length
  });

  // Animasyonlu progress bar için
  const progressAnimation = useRef(new Animated.Value(0)).current;

  // Progress bar animasyonunu başlat
  useEffect(() => {
    const startAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnimation, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(progressAnimation, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    };

    startAnimation();
  }, [progressAnimation]);

  // Araç tipi adını bul
  const getVehicleTypeName = useCallback((vehicleTypeId?: string | number) => {
    if (!vehicleTypeId || !vehicleTypes || vehicleTypes.length === 0) {
      return 'Araç Tipi Belirtilmemiş';
    }
    
    const id = typeof vehicleTypeId === 'string' ? parseInt(vehicleTypeId) : vehicleTypeId;
    const vehicleType = vehicleTypes.find(type => type.id === id);
    
    return vehicleType ? vehicleType.name : 'Bilinmeyen Araç Tipi';
  }, [vehicleTypes]);

  // Durum metnini al
  const getStatusText = (status?: string) => {
    switch (status) {
      case 'pending': return 'Bekliyor';
      case 'inspecting': return 'İnceleniyor';
      case 'accepted':
      case 'confirmed': return 'Onaylandı';
      case 'in_progress': return 'Sürücü yolda';
      case 'started': return 'Yük alındı';
      case 'transporting': return 'Taşıma durumunda';
      case 'completed': return 'Teslimat tamamlandı';
      default: return 'Bilinmeyen durum';
    }
  };

  // Durum rengini al
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'inspecting': return '#3B82F6';
      case 'accepted':
      case 'confirmed': return '#10B981';
      case 'in_progress':
      case 'started':
      case 'transporting': return '#8B5CF6';
      case 'completed': return '#059669';
      default: return '#6B7280';
    }
  };

  const vehicleTypeName = useMemo(() => {
    return getVehicleTypeName(order.vehicleTypeId || order.vehicle_type_id);
  }, [getVehicleTypeName, order.vehicleTypeId, order.vehicle_type_id]);
  
  const statusText = getStatusText(order.status);
  const statusColor = getStatusColor(order.status);

  const handlePress = () => {
    router.push('/order-detail');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color="#6B7280" />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.orderInfo}>
            <MaterialIcons name="local-shipping" size={24} color="#F59E0B" />
            <View style={styles.orderDetails}>
              <Text style={styles.orderTitle}>Aktif Siparişiniz</Text>
              <Text style={styles.orderSubtitle}>
                {order.pickupAddress && order.pickupAddress.length > 50 
                  ? `${order.pickupAddress.substring(0, 50)}...` 
                  : order.pickupAddress || 'Yükleme adresi belirtilmemiş'}
              </Text>
              <View style={styles.orderMeta}>
                <Text style={styles.orderMetaText}>
                  Sipariş #{order.id}
                </Text>
                {vehicleTypeName && (
                  <Text style={styles.orderMetaText}>
                    • {vehicleTypeName}
                  </Text>
                )}
                {order.estimatedPrice && (
                  <Text style={styles.orderMetaText}>
                    • ₺{order.estimatedPrice.toFixed(2)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Timeline Progress Indicator */}
        <View style={styles.timelineContainer}>
          <View style={styles.phaseStep}>
            <View style={[
              styles.phaseCircle,
              ['pending', 'inspecting'].includes(order.status || '') ? styles.phaseActive :
              ['accepted', 'confirmed', 'in_progress', 'started', 'transporting', 'completed'].includes(order.status || '') ? styles.phaseCompleted : styles.phaseInactive
            ]}>
              <MaterialIcons 
                name={order.status === 'inspecting' ? 'search' : 'schedule'} 
                size={12} 
                color={['pending', 'inspecting'].includes(order.status || '') ? '#F59E0B' : 
                       ['accepted', 'confirmed', 'in_progress', 'started', 'transporting', 'completed'].includes(order.status || '') ? '#FFFFFF' : '#9CA3AF'} 
              />
            </View>
            <Text style={styles.phaseLabel}>{order.status === 'inspecting' ? 'İnceleniyor' : 'Bekliyor'}</Text>
          </View>
          
          <View style={[
            styles.phaseLine,
            ['accepted', 'confirmed', 'in_progress', 'started', 'transporting', 'completed'].includes(order.status || '') ? styles.phaseLineCompleted : styles.phaseLineInactive
          ]} />
          
          <View style={styles.phaseStep}>
            <View style={[
              styles.phaseCircle,
              ['accepted', 'confirmed'].includes(order.status || '') ? styles.phaseActive :
              ['in_progress', 'started', 'transporting', 'completed'].includes(order.status || '') ? styles.phaseCompleted : styles.phaseInactive
            ]}>
              <MaterialIcons 
                name="local-shipping" 
                size={12} 
                color={['accepted', 'confirmed'].includes(order.status || '') ? '#F59E0B' : 
                       ['in_progress', 'started', 'transporting', 'completed'].includes(order.status || '') ? '#FFFFFF' : '#9CA3AF'} 
              />
            </View>
            <Text style={styles.phaseLabel}>Yolda</Text>
          </View>
          
          <View style={[
            styles.phaseLine,
            ['in_progress', 'started', 'transporting', 'completed'].includes(order.status || '') ? styles.phaseLineCompleted : styles.phaseLineInactive
          ]} />
          
          <View style={styles.phaseStep}>
            <View style={[
              styles.phaseCircle,
              order.status === 'in_progress' ? styles.phaseActive :
              ['started', 'transporting', 'completed'].includes(order.status || '') ? styles.phaseCompleted : styles.phaseInactive
            ]}>
              <MaterialIcons 
                name="inventory" 
                size={12} 
                color={order.status === 'in_progress' ? '#F59E0B' : 
                       ['started', 'transporting', 'completed'].includes(order.status || '') ? '#FFFFFF' : '#9CA3AF'} 
              />
            </View>
            <Text style={styles.phaseLabel}>Alındı</Text>
          </View>
          
          <View style={[
            styles.phaseLine,
            ['transporting', 'completed'].includes(order.status || '') ? styles.phaseLineCompleted : styles.phaseLineInactive
          ]} />
          
          <View style={styles.phaseStep}>
            <View style={[
              styles.phaseCircle,
              order.status === 'transporting' ? styles.phaseActive :
              order.status === 'completed' ? styles.phaseCompleted : styles.phaseInactive
            ]}>
              <MaterialIcons 
                name="check" 
                size={12} 
                color={order.status === 'transporting' ? '#F59E0B' : 
                       order.status === 'completed' ? '#FFFFFF' : '#9CA3AF'} 
              />
            </View>
            <Text style={styles.phaseLabel}>Teslim</Text>
          </View>
        </View>

        {/* Animasyonlu Progress Bar */}
        <View style={styles.animatedProgressContainer}>
          <View style={styles.animatedProgressTrack}>
            <Animated.View 
              style={[
                styles.animatedProgressFill,
                {
                  width: progressAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: statusColor,
                }
              ]} 
            />
          </View>
          <Text style={styles.animatedProgressText}>İşleminiz devam ediyor...</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Detayları görmek için dokunun
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginHorizontal: 0,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  content: {
    marginBottom: 16,
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  orderDetails: {
    flex: 1,
    marginLeft: 12,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  orderSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  orderMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  orderMetaText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginRight: 4,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  phaseStep: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  phaseCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  phaseActive: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  phaseCompleted: {
    backgroundColor: '#10B981',
  },
  phaseInactive: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  phaseLine: {
    height: 2,
    width: 20,
    marginHorizontal: 0,
  },
  phaseLineCompleted: {
    backgroundColor: '#10B981',
  },
  phaseLineInactive: {
    backgroundColor: '#E5E7EB',
  },
  phaseLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    flexWrap: 'wrap',
    maxWidth: 40,
  },
  animatedProgressContainer: {
    marginBottom: 12,
  },
  animatedProgressTrack: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  animatedProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  animatedProgressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ActiveOrderCard;