import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

interface Trip {
  id: number;
  pickup_address: string;
  destination_address: string;
  fare: number;
  status: 'completed' | 'cancelled' | 'ongoing';
  created_at: string;
  driver_name?: string;
  rating?: number;
}

const TripsScreen: React.FC = () => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrips = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement API call to fetch trips
      // For now, using mock data
      const mockTrips: Trip[] = [
        {
          id: 1,
          pickup_address: 'Kadıköy, İstanbul',
          destination_address: 'Beşiktaş, İstanbul',
          fare: 45.50,
          status: 'completed',
          created_at: '2024-01-15T10:30:00Z',
          driver_name: 'Mehmet Yılmaz',
          rating: 5,
        },
        {
          id: 2,
          pickup_address: 'Taksim, İstanbul',
          destination_address: 'Atatürk Havalimanı',
          fare: 85.00,
          status: 'completed',
          created_at: '2024-01-10T14:15:00Z',
          driver_name: 'Ali Demir',
          rating: 4,
        },
      ];
      setTrips(mockTrips);
    } catch (error) {
      console.error('Error loading trips:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrips();
    setRefreshing(false);
  };

  useEffect(() => {
    loadTrips();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#34C759';
      case 'cancelled':
        return '#FF3B30';
      case 'ongoing':
        return '#007AFF';
      default:
        return '#8E8E93';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Tamamlandı';
      case 'cancelled':
        return 'İptal Edildi';
      case 'ongoing':
        return 'Devam Ediyor';
      default:
        return 'Bilinmiyor';
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={16}
          color="#FFD700"
        />
      );
    }
    return stars;
  };

  const renderTripCard = (trip: Trip) => (
    <TouchableOpacity key={trip.id} style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(trip.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(trip.status) }]}>
            {getStatusText(trip.status)}
          </Text>
        </View>
        <Text style={styles.fareText}>₺{trip.fare.toFixed(2)}</Text>
      </View>

      <View style={styles.addressContainer}>
        <View style={styles.addressRow}>
          <Ionicons name="radio-button-on" size={16} color="#34C759" />
          <Text style={styles.addressText} numberOfLines={1}>
            {trip.pickup_address}
          </Text>
        </View>
        <View style={styles.addressConnector} />
        <View style={styles.addressRow}>
          <Ionicons name="location" size={16} color="#FF3B30" />
          <Text style={styles.addressText} numberOfLines={1}>
            {trip.destination_address}
          </Text>
        </View>
      </View>

      <View style={styles.tripFooter}>
        <Text style={styles.dateText}>{formatDate(trip.created_at)}</Text>
        {trip.driver_name && (
          <View style={styles.driverInfo}>
            <Text style={styles.driverText}>Şoför: {trip.driver_name}</Text>
            {trip.rating && (
              <View style={styles.ratingContainer}>
                {renderStars(trip.rating)}
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Yolculuklarım</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {trips.length > 0 ? (
          trips.map(renderTripCard)
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="car-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyStateText}>Henüz yolculuk bulunmuyor</Text>
            <Text style={styles.emptyStateSubtext}>
              İlk yolculuğunuzu yapmak için ana sayfaya gidin
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  },
  fareText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  addressContainer: {
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressConnector: {
    width: 2,
    height: 16,
    backgroundColor: '#E1E5E9',
    marginLeft: 7,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#1A1A1A',
    marginLeft: 12,
    flex: 1,
  },
  tripFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E1E5E9',
    paddingTop: 12,
  },
  dateText: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
  },
  driverInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverText: {
    fontSize: 14,
    color: '#666666',
  },
  ratingContainer: {
    flexDirection: 'row',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default TripsScreen;