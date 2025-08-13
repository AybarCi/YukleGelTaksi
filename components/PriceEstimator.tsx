import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DollarSign, Clock, Route } from 'lucide-react-native';

interface PriceEstimatorProps {
  pickup: string;
  delivery: string;
  cargoType: string;
  weight: string;
  onPriceCalculated: (price: number) => void;
}

export default function PriceEstimator({
  pickup,
  delivery,
  cargoType,
  weight,
  onPriceCalculated,
}: PriceEstimatorProps) {
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    // Simulate price calculation
    const calculatePrice = () => {
      const basePrice = 50;
      const weightMultiplier = weight ? parseInt(weight) * 0.5 : 20;
      const typeMultiplier = cargoType === 'furniture' ? 1.5 : cargoType === 'appliance' ? 1.3 : 1.0;
      const distanceMultiplier = Math.random() * 20 + 10; // Simulate distance
      
      const total = Math.round(basePrice + weightMultiplier + (distanceMultiplier * typeMultiplier));
      const time = Math.round(distanceMultiplier * 2 + 15);
      const dist = Math.round(distanceMultiplier);
      
      setEstimatedPrice(total);
      setEstimatedTime(time);
      setDistance(dist);
      onPriceCalculated(total);
    };

    if (pickup && delivery && cargoType) {
      setTimeout(calculatePrice, 500); // Simulate API call delay
    }
  }, [pickup, delivery, cargoType, weight]);

  if (!pickup || !delivery || !cargoType) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fiyat Tahmini</Text>
      
      <View style={styles.estimateCard}>
        <View style={styles.estimateRow}>
          <View style={styles.estimateItem}>
            <DollarSign size={20} color="#F97316" />
            <Text style={styles.estimateLabel}>Tutar</Text>
            <Text style={styles.estimateValue}>₺{estimatedPrice}</Text>
          </View>
          
          <View style={styles.estimateItem}>
            <Clock size={20} color="#3B82F6" />
            <Text style={styles.estimateLabel}>Süre</Text>
            <Text style={styles.estimateValue}>{estimatedTime} dk</Text>
          </View>
          
          <View style={styles.estimateItem}>
            <Route size={20} color="#10B981" />
            <Text style={styles.estimateLabel}>Mesafe</Text>
            <Text style={styles.estimateValue}>{distance} km</Text>
          </View>
        </View>
        
        <View style={styles.priceBreakdown}>
          <Text style={styles.breakdownTitle}>Fiyat Detayı</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Temel Ücret</Text>
            <Text style={styles.breakdownValue}>₺50</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Mesafe ({distance} km)</Text>
            <Text style={styles.breakdownValue}>₺{Math.round(distance * 2)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Yük Türü</Text>
            <Text style={styles.breakdownValue}>₺{estimatedPrice - 50 - Math.round(distance * 2)}</Text>
          </View>
        </View>
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
  estimateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  estimateItem: {
    alignItems: 'center',
    gap: 4,
  },
  estimateLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  estimateValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  priceBreakdown: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  breakdownValue: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '500',
  },
});