import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { MapPin, Navigation, Truck, Phone, MessageSquare, Clock, User } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TrackingScreenProps {
  driverData: {
    name: string;
    rating: number;
    vehicleType: string;
    phone: string;
  };
  routeData: {
    pickup: string;
    delivery: string;
  };
  onBack: () => void;
}

export default function TrackingScreen({ driverData, routeData, onBack }: TrackingScreenProps) {
  const [driverPosition, setDriverPosition] = useState({ x: 80, y: 120 });
  const [estimatedTime, setEstimatedTime] = useState(15);

  // Simulate driver movement
  useEffect(() => {
    const interval = setInterval(() => {
      setDriverPosition(prev => ({
        x: Math.min(prev.x + 2, 180),
        y: prev.y + (Math.random() - 0.5) * 4
      }));
      setEstimatedTime(prev => Math.max(prev - 0.5, 0));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {/* Map Area */}
      <View style={styles.mapContainer}>
        {/* Map Background */}
        <View style={styles.mapBackground}>
          {/* Grid Lines */}
          <View style={styles.gridContainer}>
            {Array.from({ length: 8 }).map((_, i) => (
              <View key={`v-${i}`} style={[styles.gridLineVertical, { left: i * 50 }]} />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={`h-${i}`} style={[styles.gridLineHorizontal, { top: i * 60 }]} />
            ))}
          </View>

          {/* Street Names */}
          <Text style={[styles.streetName, { top: 40, left: 20 }]}>Merkez Mahallesi</Text>
          <Text style={[styles.streetName, { top: 120, left: 180 }]}>İş Merkezi</Text>
          <Text style={[styles.streetName, { top: 200, left: 60 }]}>Konut Bölgesi</Text>

          {/* Pickup Location */}
          <View style={[styles.locationMarker, { top: 100, left: 180 }]}>
            <View style={styles.pickupPoint}>
              <MapPin size={16} color="#FFFFFF" />
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Alış</Text>
              <Text style={styles.locationAddress}>{routeData.pickup.substring(0, 20)}...</Text>
            </View>
          </View>

          {/* Delivery Location */}
          <View style={[styles.locationMarker, { top: 220, left: 280 }]}>
            <View style={styles.deliveryPoint}>
              <Navigation size={16} color="#FFFFFF" />
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Teslim</Text>
              <Text style={styles.locationAddress}>{routeData.delivery.substring(0, 20)}...</Text>
            </View>
          </View>

          {/* Route Path */}
          <View style={styles.routePath}>
            <View style={[styles.routeSegment, { top: 112, left: 195, width: 90, transform: [{ rotate: '25deg' }] }]} />
            <View style={[styles.routeSegment, { top: 160, left: 240, width: 60, transform: [{ rotate: '45deg' }] }]} />
          </View>

          {/* Driver Position */}
          <View style={[styles.driverMarker, { top: driverPosition.y, left: driverPosition.x }]}>
            <View style={styles.driverIcon}>
              <Truck size={16} color="#FFFFFF" />
            </View>
            <View style={styles.driverPulse} />
          </View>
        </View>

        {/* Status Banner */}
        <View style={styles.statusBanner}>
          <View style={styles.statusIcon}>
            <Truck size={20} color="#10B981" />
          </View>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>Sürücü Yolda</Text>
            <Text style={styles.statusSubtitle}>
              {Math.round(estimatedTime)} dakika içinde size ulaşacak
            </Text>
          </View>
        </View>
      </View>

      {/* Driver Info Card */}
      <View style={styles.driverCard}>
        <View style={styles.driverHeader}>
          <View style={styles.driverAvatar}>
            <User size={24} color="#F97316" />
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{driverData.name}</Text>
            <Text style={styles.driverVehicle}>{driverData.vehicleType}</Text>
            <View style={styles.ratingContainer}>
              <Text style={styles.rating}>⭐ {driverData.rating}</Text>
            </View>
          </View>
          <View style={styles.contactButtons}>
            <TouchableOpacity style={styles.contactButton}>
              <Phone size={18} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactButton}>
              <MessageSquare size={18} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Trip Details */}
        <View style={styles.tripDetails}>
          <View style={styles.tripItem}>
            <Clock size={16} color="#6B7280" />
            <Text style={styles.tripText}>Tahmini Varış: {Math.round(estimatedTime)} dk</Text>
          </View>
          <View style={styles.tripItem}>
            <MapPin size={16} color="#F97316" />
            <Text style={styles.tripText}>Mesafe: 12 km</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>İptal Et</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton}>
            <Text style={styles.shareButtonText}>Konumu Paylaş</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapBackground: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  streetName: {
    position: 'absolute',
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  locationMarker: {
    position: 'absolute',
    alignItems: 'center',
  },
  pickupPoint: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  deliveryPoint: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  locationInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    alignItems: 'center',
    minWidth: 80,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1F2937',
  },
  locationAddress: {
    fontSize: 8,
    color: '#6B7280',
    textAlign: 'center',
  },
  routePath: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  routeSegment: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  driverMarker: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 10,
  },
  driverPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    opacity: 0.3,
    zIndex: 5,
  },
  statusBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  driverVehicle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  ratingContainer: {
    marginTop: 4,
  },
  rating: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '500',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 10,
  },
  tripDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});