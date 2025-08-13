import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

interface OffersStepProps {
  data: any;
  onBack: () => void;
  onSelectDriver?: (driverData: any) => void;
}

interface DriverOffer {
  id: number;
  driverName: string;
  rating: number;
  completedTrips: number;
  vehicleType: string;
  price: number;
  estimatedTime: string;
  distance: string;
}

export default function OffersStep({ data, onBack, onSelectDriver }: OffersStepProps) {
  const [offers, setOffers] = useState<DriverOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching offers from drivers
    const fetchOffers = () => {
      setTimeout(() => {
        const mockOffers: DriverOffer[] = [
          {
            id: 1,
            driverName: 'Mehmet Kaya',
            rating: 4.8,
            completedTrips: 245,
            vehicleType: 'Ford Transit',
            price: 120,
            estimatedTime: '15 dk',
            distance: '12 km',
          },
          {
            id: 2,
            driverName: 'Fatma Şahin',
            rating: 4.9,
            completedTrips: 189,
            vehicleType: 'Fiat Doblo',
            price: 110,
            estimatedTime: '18 dk',
            distance: '12 km',
          },
          {
            id: 3,
            driverName: 'Ali Demir',
            rating: 4.7,
            completedTrips: 156,
            vehicleType: 'Renault Kangoo',
            price: 135,
            estimatedTime: '12 dk',
            distance: '12 km',
          },
        ];
        setOffers(mockOffers);
        setLoading(false);
      }, 2000);
    };

    fetchOffers();
  }, []);

  const handleSelectOffer = (offer: DriverOffer) => {
    // Pass selected driver data to parent
    if (onSelectDriver) {
      onSelectDriver({
        name: offer.driverName,
        rating: offer.rating,
        vehicleType: offer.vehicleType,
        phone: '+90 555 123 45 67'
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingTitle}>
            {offers.length} sürücüden teklif geldi
          </Text>
          <Text style={styles.loadingSubtitle}>
            Bu sadece birkaç saniye sürecek
          </Text>
          <View style={styles.loadingDots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.description}>
        Size en yakın {offers.length} sürücü bulundu
      </Text>

      <ScrollView style={styles.offersList} showsVerticalScrollIndicator={false}>
        {offers.map((offer) => (
          <View key={offer.id} style={styles.offerCard}>
            <View style={styles.driverInfo}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color="#6B7280" />
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{offer.driverName}</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={styles.rating}>{offer.rating}</Text>
                  <Text style={styles.trips}>({offer.completedTrips} sefer)</Text>
                </View>
                <View style={styles.vehicleContainer}>
                  <Ionicons name="car" size={14} color="#6B7280" />
                  <Text style={styles.vehicleType}>{offer.vehicleType}</Text>
                </View>
              </View>
              <View style={styles.priceContainer}>
                <Text style={styles.price}>₺{offer.price}</Text>
                <View style={styles.timeContainer}>
                  <Ionicons name="time" size={12} color="#6B7280" />
                  <Text style={styles.time}>{offer.estimatedTime}</Text>
                </View>
              </View>
            </View>

            <View style={styles.offerActions}>
              <TouchableOpacity style={styles.contactButton}>
                <Ionicons name="call" size={16} color="#3B82F6" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactButton}>
                <Ionicons name="chatbubble" size={16} color="#3B82F6" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.selectButton}
                onPress={() => handleSelectOffer(offer)}
              >
                <Text style={styles.selectButtonText}>Seç</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.waitButton}>
        <Text style={styles.waitButtonText}>Daha Fazla Sürücü Ara</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  dotActive: {
    backgroundColor: '#F97316',
  },
  offersList: {
    flex: 1,
    marginBottom: 16,
  },
  offerCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  trips: {
    fontSize: 12,
    color: '#6B7280',
  },
  vehicleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vehicleType: {
    fontSize: 12,
    color: '#6B7280',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F97316',
    marginBottom: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  time: {
    fontSize: 12,
    color: '#6B7280',
  },
  offerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactButton: {
    backgroundColor: '#EFF6FF',
    padding: 8,
    borderRadius: 8,
  },
  selectButton: {
    flex: 1,
    backgroundColor: '#FCD34D',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  waitButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  waitButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
});

// export default OffersStep