import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface Order {
  id: string;
  status: string;
  pickup_address?: string;
  pickup_latitude?: string;
  pickup_longitude?: string;
  destination_latitude?: string;
  destination_longitude?: string;
}

interface OrderCardProps {
  currentOrder: Order | null;
  onPress: () => void;
  styles: any;
}

const OrderCard: React.FC<OrderCardProps> = ({ 
  currentOrder, 
  onPress, 
  styles 
}) => {
  if (!currentOrder) return null;

  return (
    <View style={{ paddingVertical: 8 }}>
      <TouchableOpacity
        style={styles.ongoingOrderCard}
        onPress={onPress}
      >
        <View style={styles.cardHeader}>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {currentOrder?.status === 'pending' && 'Bekliyor'}
              {currentOrder?.status === 'inspecting' && 'İnceleniyor'}
              {['accepted', 'confirmed'].includes(currentOrder?.status || '') && 'Onaylandı'}
              {currentOrder?.status === 'in_progress' && 'Sürücü yolda'}
              {currentOrder?.status === 'started' && 'Yük alındı'}
              {currentOrder?.status === 'transporting' && 'Taşıma durumunda'}
              {currentOrder?.status === 'completed' && 'Teslimat tamamlandı'}
            </Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color="#6B7280" />
        </View>
        
        <View style={styles.cardContent}>
          <View style={styles.orderInfo}>
            <MaterialIcons name="local-shipping" size={24} color="#F59E0B" />
            <View style={styles.orderDetails}>
              <Text style={styles.orderTitle}>Aktif Siparişiniz</Text>
              <Text style={styles.orderSubtitle}>
                {currentOrder?.pickup_address ? 
                  `${currentOrder.pickup_address.substring(0, 30)}...` : 
                  'Yük taşıma siparişi'
                }
              </Text>
              <Text style={styles.orderStatus}>
                Sipariş #{currentOrder?.id} • {
                  currentOrder?.status === 'pending' ? 'Bekliyor' :
                  currentOrder?.status === 'inspecting' ? 'İnceleniyor' :
                  ['accepted', 'confirmed'].includes(currentOrder?.status || '') ? 'Onaylandı' :
                  currentOrder?.status === 'in_progress' ? 'Sürücü yolda' :
                  currentOrder?.status === 'started' ? 'Yük alındı' :
                  currentOrder?.status === 'transporting' ? 'Taşıma durumunda' :
                  currentOrder?.status === 'completed' ? 'Teslimat tamamlandı' :
                  'Bilinmeyen durum'
                }
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.cardFooter}>
          {/* Aşamalı takip göstergesi */}
          <View style={styles.phaseTrackingContainer}>
            <View style={styles.phaseStep}>
              <View style={[
                styles.phaseCircle,
                ['pending', 'inspecting'].includes(currentOrder?.status || '') ? styles.phaseActive :
                ['accepted', 'confirmed', 'in_progress', 'started', 'completed'].includes(currentOrder?.status || '') ? styles.phaseCompleted : styles.phaseInactive
              ]}>
                <MaterialIcons 
                  name={currentOrder?.status === 'inspecting' ? 'search' : 'schedule'} 
                  size={12} 
                  color={['pending', 'inspecting'].includes(currentOrder?.status || '') ? '#F59E0B' : 
                         ['accepted', 'confirmed', 'in_progress', 'started', 'completed'].includes(currentOrder?.status || '') ? '#FFFFFF' : '#9CA3AF'} 
                />
              </View>
              <Text style={styles.phaseLabel}>{currentOrder?.status === 'inspecting' ? 'İnceleniyor' : 'Bekliyor'}</Text>
            </View>
            
            <View style={[
              styles.phaseLine,
              ['accepted', 'confirmed', 'in_progress', 'started', 'completed'].includes(currentOrder?.status || '') ? styles.phaseLineCompleted : styles.phaseLineInactive
            ]} />
            
            <View style={styles.phaseStep}>
              <View style={[
                styles.phaseCircle,
                ['accepted', 'confirmed'].includes(currentOrder?.status || '') ? styles.phaseActive :
                ['in_progress', 'started', 'completed'].includes(currentOrder?.status || '') ? styles.phaseCompleted : styles.phaseInactive
              ]}>
                <MaterialIcons 
                  name="local-shipping" 
                  size={12} 
                  color={['accepted', 'confirmed'].includes(currentOrder?.status || '') ? '#F59E0B' : 
                         ['in_progress', 'started', 'completed'].includes(currentOrder?.status || '') ? '#FFFFFF' : '#9CA3AF'} 
                />
              </View>
              <Text style={styles.phaseLabel}>Yolda</Text>
            </View>
            
            <View style={[
              styles.phaseLine,
              ['in_progress', 'started', 'completed'].includes(currentOrder?.status || '') ? styles.phaseLineCompleted : styles.phaseLineInactive
            ]} />
            
            <View style={styles.phaseStep}>
              <View style={[
                styles.phaseCircle,
                currentOrder?.status === 'in_progress' ? styles.phaseActive :
                ['started', 'completed'].includes(currentOrder?.status || '') ? styles.phaseCompleted : styles.phaseInactive
              ]}>
                <MaterialIcons 
                  name="inventory" 
                  size={12} 
                  color={currentOrder?.status === 'in_progress' ? '#F59E0B' : 
                         ['started', 'completed'].includes(currentOrder?.status || '') ? '#FFFFFF' : '#9CA3AF'} 
                />
              </View>
              <Text style={styles.phaseLabel}>Yük Alımı</Text>
            </View>
            
            <View style={[
              styles.phaseLine,
              ['started', 'completed'].includes(currentOrder?.status || '') ? styles.phaseLineCompleted : styles.phaseLineInactive
            ]} />
            
            <View style={styles.phaseStep}>
              <View style={[
                styles.phaseCircle,
                currentOrder?.status === 'started' ? styles.phaseActive :
                currentOrder?.status === 'completed' ? styles.phaseCompleted : styles.phaseInactive
              ]}>
                <MaterialIcons 
                  name="place" 
                  size={12} 
                  color={currentOrder?.status === 'started' ? '#F59E0B' : 
                         currentOrder?.status === 'completed' ? '#FFFFFF' : '#9CA3AF'} 
                />
              </View>
              <Text style={styles.phaseLabel}>Teslimat</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default OrderCard;