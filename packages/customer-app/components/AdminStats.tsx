import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Users, Truck, DollarSign, Star } from 'lucide-react-native';

interface AdminStatsProps {
  stats: {
    totalOrders: number;
    activeDrivers: number;
    todayRevenue: number;
    averageRating: number;
  };
}

export default function AdminStats({ stats }: AdminStatsProps) {
  const statItems = [
    {
      icon: DollarSign,
      title: 'Günlük Gelir',
      value: `₺${stats.todayRevenue.toLocaleString()}`,
      color: '#10B981',
    },
    {
      icon: Truck,
      title: 'Aktif Sürücü',
      value: stats.activeDrivers.toString(),
      color: '#3B82F6',
    },
    {
      icon: Users,
      title: 'Toplam Sipariş',
      value: stats.totalOrders.toString(),
      color: '#F59E0B',
    },
    {
      icon: Star,
      title: 'Ortalama Puan',
      value: stats.averageRating.toString(),
      color: '#EF4444',
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Günlük İstatistikler</Text>
      <View style={styles.statsGrid}>
        {statItems.map((item, index) => (
          <View key={index} style={styles.statCard}>
            <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
              <item.icon size={24} color={item.color} />
            </View>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statTitle}>{item.title}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});