import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_CONFIG } from '../config/api';

const { width } = Dimensions.get('window');

interface EarningsData {
  total_earnings: number;
  today_earnings: number;
  week_earnings: number;
  month_earnings: number;
  total_trips: number;
  today_trips: number;
  week_trips: number;
  month_trips: number;
  average_fare: number;
  commission_rate: number;
  net_earnings: number;
}

interface DailyEarning {
  date: string;
  earnings: number;
  trips: number;
  hours_worked: number;
}

export default function DriverEarningsScreen() {
  const insets = useSafeAreaInsets();
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [dailyEarnings, setDailyEarnings] = useState<DailyEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');

  useEffect(() => {
    loadEarningsData();
  }, [selectedPeriod]);

  const loadEarningsData = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Hata', 'Oturum bilgisi bulunamadı');
        return;
      }

      const [earningsResponse, dailyResponse] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/api/driver/earnings`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${API_CONFIG.BASE_URL}/api/driver/earnings/daily?period=${selectedPeriod}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
      ]);

      if (earningsResponse.ok) {
        const earningsData = await earningsResponse.json();
        setEarnings(earningsData);
      } else {
        Alert.alert('Hata', 'Kazanç bilgileri alınamadı');
      }

      if (dailyResponse.ok) {
        const dailyData = await dailyResponse.json();
        setDailyEarnings(dailyData);
      }
    } catch (error) {
      console.error('Earnings load error:', error);
      Alert.alert('Hata', 'Bir hata oluştu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEarningsData();
  };

  const formatCurrency = (amount: number) => {
    return `₺${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const getPeriodEarnings = () => {
    if (!earnings) return 0;
    switch (selectedPeriod) {
      case 'today':
        return earnings.today_earnings;
      case 'week':
        return earnings.week_earnings;
      case 'month':
        return earnings.month_earnings;
      case 'all':
        return earnings.total_earnings;
      default:
        return 0;
    }
  };

  const getPeriodTrips = () => {
    if (!earnings) return 0;
    switch (selectedPeriod) {
      case 'today':
        return earnings.today_trips;
      case 'week':
        return earnings.week_trips;
      case 'month':
        return earnings.month_trips;
      case 'all':
        return earnings.total_trips;
      default:
        return 0;
    }
  };

  const getPeriodText = () => {
    switch (selectedPeriod) {
      case 'today':
        return 'Bugün';
      case 'week':
        return 'Bu Hafta';
      case 'month':
        return 'Bu Ay';
      case 'all':
        return 'Toplam';
      default:
        return 'Bugün';
    }
  };

  const renderStatCard = (title: string, value: string, icon: string, color: string) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Ionicons name={icon as any} size={24} color={color} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );

  const renderDailyEarningItem = (item: DailyEarning, index: number) => (
    <View key={index} style={styles.dailyItem}>
      <View style={styles.dailyDate}>
        <Text style={styles.dailyDateText}>{formatDate(item.date)}</Text>
        <Text style={styles.dailyTripsText}>{item.trips} sefer</Text>
      </View>
      <View style={styles.dailyEarnings}>
        <Text style={styles.dailyEarningsText}>{formatCurrency(item.earnings)}</Text>
        <Text style={styles.dailyHoursText}>{item.hours_worked.toFixed(1)} saat</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
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
        <Text style={styles.headerTitle}>Kazançlarım</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Period Selector */}
        <View style={styles.periodContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[{ key: 'today', label: 'Bugün' }, { key: 'week', label: 'Bu Hafta' }, { key: 'month', label: 'Bu Ay' }, { key: 'all', label: 'Toplam' }].map((period) => (
              <TouchableOpacity
                key={period.key}
                style={[styles.periodTab, selectedPeriod === period.key && styles.activePeriodTab]}
                onPress={() => setSelectedPeriod(period.key as any)}
              >
                <Text style={[styles.periodText, selectedPeriod === period.key && styles.activePeriodText]}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Main Earnings Card */}
        <View style={styles.mainCard}>
          <Text style={styles.periodLabel}>{getPeriodText()} Kazancınız</Text>
          <Text style={styles.mainEarnings}>{formatCurrency(getPeriodEarnings())}</Text>
          <View style={styles.mainStats}>
            <View style={styles.mainStatItem}>
              <Ionicons name="car" size={20} color="#6B7280" />
              <Text style={styles.mainStatText}>{getPeriodTrips()} Sefer</Text>
            </View>
            {earnings && (
              <View style={styles.mainStatItem}>
                <Ionicons name="trending-up" size={20} color="#6B7280" />
                <Text style={styles.mainStatText}>Ort. {formatCurrency(earnings.average_fare)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {earnings && (
            <>
              {renderStatCard('Net Kazanç', formatCurrency(earnings.net_earnings), 'wallet', '#FFD700')}
              {renderStatCard('Komisyon Oranı', `%${(earnings.commission_rate * 100).toFixed(1)}`, 'pie-chart', '#FFD700')}
              {renderStatCard('Toplam Sefer', earnings.total_trips.toString(), 'car', '#3B82F6')}
              {renderStatCard('Ortalama Ücret', formatCurrency(earnings.average_fare), 'trending-up', '#8B5CF6')}
            </>
          )}
        </View>

        {/* Daily Breakdown */}
        {dailyEarnings.length > 0 && (
          <View style={styles.dailySection}>
            <Text style={styles.sectionTitle}>Günlük Detay</Text>
            <View style={styles.dailyList}>
              {dailyEarnings.map(renderDailyEarningItem)}
            </View>
          </View>
        )}

        {/* Commission Info */}
        {earnings && (
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle" size={24} color="#3B82F6" />
              <Text style={styles.infoTitle}>Komisyon Bilgisi</Text>
            </View>
            <Text style={styles.infoText}>
              Toplam kazancınızdan %{(earnings.commission_rate * 100).toFixed(1)} komisyon düşülmektedir.
              Net kazancınız: {formatCurrency(earnings.net_earnings)}
            </Text>
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
  periodContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  periodTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
  },
  activePeriodTab: {
    backgroundColor: '#FFD700',
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activePeriodText: {
    color: '#FFFFFF',
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  periodLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  mainEarnings: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 16,
  },
  mainStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  mainStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainStatText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  statsGrid: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  dailySection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
  },
  dailyList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dailyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dailyDate: {
    flex: 1,
  },
  dailyDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  dailyTripsText: {
    fontSize: 14,
    color: '#6B7280',
  },
  dailyEarnings: {
    alignItems: 'flex-end',
  },
  dailyEarningsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  dailyHoursText: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});