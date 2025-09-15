import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_CONFIG } from '../config/api';
import SplashLoader from '../components/SplashLoader';
interface Review {
  id: number;
  customer_name: string;
  customer_avatar?: string;
  rating: number;
  comment?: string;
  created_at: string;
  trip_id: number;
  pickup_address: string;
  destination_address: string;
}

interface RatingStats {
  average_rating: number;
  total_reviews: number;
  rating_distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export default function DriverReviewsScreen() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');

  useEffect(() => {
    loadReviews();
  }, [filter]);

  const loadReviews = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Hata', 'Oturum bilgisi bulunamadı');
        return;
      }

      const [reviewsResponse, statsResponse] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/api/driver/reviews?rating=${filter === 'all' ? '' : filter}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${API_CONFIG.BASE_URL}/api/driver/reviews/stats`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
      ]);

      if (reviewsResponse.ok) {
        const reviewsData = await reviewsResponse.json();
        setReviews(reviewsData);
      } else {
        Alert.alert('Hata', 'Değerlendirmeler alınamadı');
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Reviews load error:', error);
      Alert.alert('Hata', 'Bir hata oluştu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadReviews();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const renderStars = (rating: number, size: number = 16) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={size}
          color={i <= rating ? '#FCD34D' : '#D1D5DB'}
        />
      );
    }
    return <View style={styles.starsContainer}>{stars}</View>;
  };

  const renderRatingBar = (rating: number, count: number, total: number) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return (
      <TouchableOpacity
        style={styles.ratingBarContainer}
        onPress={() => setFilter(rating.toString() as any)}
      >
        <Text style={styles.ratingBarLabel}>{rating}</Text>
        <Ionicons name="star" size={16} color="#FCD34D" />
        <View style={styles.ratingBarTrack}>
          <View style={[styles.ratingBarFill, { width: `${percentage}%` }]} />
        </View>
        <Text style={styles.ratingBarCount}>{count}</Text>
      </TouchableOpacity>
    );
  };

  const renderReviewItem = (review: Review) => (
    <View key={review.id} style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.customerInfo}>
          <View style={styles.customerAvatar}>
            {review.customer_avatar ? (
              <Image source={{ uri: review.customer_avatar }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={24} color="#9CA3AF" />
            )}
          </View>
          <View style={styles.customerDetails}>
            <Text style={styles.customerName}>{review.customer_name}</Text>
            <Text style={styles.reviewDate}>{formatDate(review.created_at)}</Text>
          </View>
        </View>
        {renderStars(review.rating, 18)}
      </View>

      {review.comment && (
        <Text style={styles.reviewComment}>{review.comment}</Text>
      )}

      <View style={styles.tripInfo}>
        <View style={styles.tripRoute}>
          <View style={styles.routePoint}>
            <Ionicons name="radio-button-on" size={12} color="#FFD700" />
            <Text style={styles.routeText} numberOfLines={1}>
              {review.pickup_address}
            </Text>
          </View>
          <View style={styles.routePoint}>
            <Ionicons name="location" size={12} color="#EF4444" />
            <Text style={styles.routeText} numberOfLines={1}>
              {review.destination_address}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SplashLoader 
        visible={true} 
        text="Değerlendirmeler yükleniyor..." 
        logoSize={120}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Değerlendirmeler</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Rating Overview */}
        {stats && (
          <View style={styles.overviewCard}>
            <View style={styles.overviewHeader}>
              <View style={styles.ratingOverview}>
                <Text style={styles.averageRating}>{stats.average_rating.toFixed(1)}</Text>
                {renderStars(Math.round(stats.average_rating), 24)}
                <Text style={styles.totalReviews}>{stats.total_reviews} değerlendirme</Text>
              </View>
            </View>
            
            <View style={styles.ratingDistribution}>
              {[5, 4, 3, 2, 1].map((rating) => 
                renderRatingBar(rating, stats.rating_distribution[rating as keyof typeof stats.rating_distribution], stats.total_reviews)
              )}
            </View>
          </View>
        )}

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity 
              style={[styles.filterTab, filter === 'all' && styles.activeFilterTab]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>
                Tümü
              </Text>
            </TouchableOpacity>
            {[5, 4, 3, 2, 1].map((rating) => (
              <TouchableOpacity 
                key={rating}
                style={[styles.filterTab, filter === rating.toString() && styles.activeFilterTab]}
                onPress={() => setFilter(rating.toString() as any)}
              >
                <View style={styles.filterTabContent}>
                  <Text style={[styles.filterText, filter === rating.toString() && styles.activeFilterText]}>
                    {rating}
                  </Text>
                  <Ionicons 
                    name="star" 
                    size={14} 
                    color={filter === rating.toString() ? '#FFFFFF' : '#FCD34D'} 
                  />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Değerlendirme bulunamadı</Text>
            <Text style={styles.emptyText}>
              {filter === 'all' 
                ? 'Henüz hiç değerlendirme almamışsınız.' 
                : `${filter} yıldızlı değerlendirme bulunmuyor.`
              }
            </Text>
          </View>
        ) : (
          <View style={styles.reviewsList}>
            {reviews.map(renderReviewItem)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  overviewHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  ratingOverview: {
    alignItems: 'center',
  },
  averageRating: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  totalReviews: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
  ratingDistribution: {
    width: '100%',
  },
  ratingBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingBarLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    width: 12,
  },
  ratingBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: '#FCD34D',
  },
  ratingBarCount: {
    fontSize: 14,
    color: '#6B7280',
    width: 24,
    textAlign: 'right',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
  },
  activeFilterTab: {
    backgroundColor: '#FFD700',
  },
  filterTabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 4,
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
  },
  reviewsList: {
    padding: 20,
  },
  reviewCard: {
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
    shadowRadius: 3.84,
    elevation: 5,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  starsContainer: {
    flexDirection: 'row',
  },
  reviewComment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  tripInfo: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  tripRoute: {
    flex: 1,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  routeText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
});