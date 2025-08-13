import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, Dimensions } from 'react-native';
import { Truck, MapPin, Navigation } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Driver {
  id: number;
  name: string;
  x: number;
  y: number;
  status: 'available' | 'busy' | 'offline';
  vehicleType: string;
  targetX?: number;
  targetY?: number;
  route?: { x: number; y: number }[];
  routeIndex?: number;
}

// Street network - main roads and intersections
const STREET_NETWORK = [
  // Horizontal streets
  { id: 'h1', y: 80, x1: 0, x2: SCREEN_WIDTH, type: 'main' },
  { id: 'h2', y: 140, x1: 0, x2: SCREEN_WIDTH, type: 'secondary' },
  { id: 'h3', y: 180, x1: 0, x2: SCREEN_WIDTH, type: 'main' },
  { id: 'h4', y: 240, x1: 0, x2: SCREEN_WIDTH, type: 'secondary' },
  { id: 'h5', y: 280, x1: 0, x2: SCREEN_WIDTH, type: 'main' },
  { id: 'h6', y: 340, x1: 0, x2: SCREEN_WIDTH, type: 'secondary' },
  
  // Vertical streets
  { id: 'v1', x: 80, y1: 0, y2: 400, type: 'secondary' },
  { id: 'v2', x: 120, y1: 0, y2: 400, type: 'main' },
  { id: 'v3', x: 180, y1: 0, y2: 400, type: 'secondary' },
  { id: 'v4', x: 220, y1: 0, y2: 400, type: 'main' },
  { id: 'v5', x: 280, y1: 0, y2: 400, type: 'secondary' },
  { id: 'v6', x: 320, y1: 0, y2: 400, type: 'secondary' },
];

// Street intersections for navigation
const INTERSECTIONS = [
  { x: 80, y: 80 }, { x: 120, y: 80 }, { x: 180, y: 80 }, { x: 220, y: 80 }, { x: 280, y: 80 }, { x: 320, y: 80 },
  { x: 80, y: 140 }, { x: 120, y: 140 }, { x: 180, y: 140 }, { x: 220, y: 140 }, { x: 280, y: 140 }, { x: 320, y: 140 },
  { x: 80, y: 180 }, { x: 120, y: 180 }, { x: 180, y: 180 }, { x: 220, y: 180 }, { x: 280, y: 180 }, { x: 320, y: 180 },
  { x: 80, y: 240 }, { x: 120, y: 240 }, { x: 180, y: 240 }, { x: 220, y: 240 }, { x: 280, y: 240 }, { x: 320, y: 240 },
  { x: 80, y: 280 }, { x: 120, y: 280 }, { x: 180, y: 280 }, { x: 220, y: 280 }, { x: 280, y: 280 }, { x: 320, y: 280 },
  { x: 80, y: 340 }, { x: 120, y: 340 }, { x: 180, y: 340 }, { x: 220, y: 340 }, { x: 280, y: 340 }, { x: 320, y: 340 },
];

// Find nearest intersection to a point
const findNearestIntersection = (x: number, y: number) => {
  let nearest = INTERSECTIONS[0];
  let minDistance = Math.sqrt(Math.pow(x - nearest.x, 2) + Math.pow(y - nearest.y, 2));
  
  INTERSECTIONS.forEach(intersection => {
    const distance = Math.sqrt(Math.pow(x - intersection.x, 2) + Math.pow(y - intersection.y, 2));
    if (distance < minDistance) {
      minDistance = distance;
      nearest = intersection;
    }
  });
  
  return nearest;
};

// Generate route between two intersections
const generateRoute = (start: { x: number; y: number }, end: { x: number; y: number }) => {
  const route = [start];
  let current = start;
  
  // Simple pathfinding - move horizontally then vertically
  if (current.x !== end.x) {
    const targetX = end.x;
    const step = current.x < targetX ? 40 : -40;
    while (current.x !== targetX) {
      current = { x: current.x + step, y: current.y };
      route.push({ ...current });
    }
  }
  
  if (current.y !== end.y) {
    const targetY = end.y;
    const step = current.y < targetY ? 40 : -40;
    while (current.y !== targetY) {
      current = { x: current.x, y: current.y + step };
      route.push({ ...current });
    }
  }
  
  return route;
};

export default function InteractiveMap() {
  const [drivers, setDrivers] = useState<Driver[]>([
    { id: 1, name: 'Mehmet K.', x: 120, y: 180, status: 'available', vehicleType: 'Ford Transit', routeIndex: 0 },
    { id: 2, name: 'Fatma S.', x: 220, y: 140, status: 'busy', vehicleType: 'Fiat Doblo', routeIndex: 0 },
    { id: 3, name: 'Ali D.', x: 80, y: 280, status: 'available', vehicleType: 'Renault Kangoo', routeIndex: 0 },
    { id: 4, name: 'Ayşe M.', x: 280, y: 240, status: 'available', vehicleType: 'Ford Transit', routeIndex: 0 },
    { id: 5, name: 'Hasan T.', x: 180, y: 340, status: 'offline', vehicleType: 'Iveco Daily', routeIndex: 0 },
    { id: 6, name: 'Zeynep A.', x: 320, y: 180, status: 'busy', vehicleType: 'Mercedes Sprinter', routeIndex: 0 },
  ]);

  const [draggedDriver, setDraggedDriver] = useState<number | null>(null);

  // Initialize routes for drivers
  useEffect(() => {
    setDrivers(prevDrivers =>
      prevDrivers.map(driver => {
        if (driver.status === 'offline') return driver;
        
        const currentIntersection = findNearestIntersection(driver.x, driver.y);
        const randomTarget = INTERSECTIONS[Math.floor(Math.random() * INTERSECTIONS.length)];
        const route = generateRoute(currentIntersection, randomTarget);
        
        return {
          ...driver,
          route,
          routeIndex: 0,
          x: currentIntersection.x,
          y: currentIntersection.y,
        };
      })
    );
  }, []);

  // Street-based driver movement
  useEffect(() => {
    const interval = setInterval(() => {
      setDrivers(prevDrivers =>
        prevDrivers.map(driver => {
          if (driver.status === 'offline' || !driver.route || draggedDriver === driver.id) return driver;
          
          const currentRouteIndex = driver.routeIndex || 0;
          
          // Move to next point in route
          if (currentRouteIndex < driver.route.length - 1) {
            const nextPoint = driver.route[currentRouteIndex + 1];
            return {
              ...driver,
              x: nextPoint.x,
              y: nextPoint.y,
              routeIndex: currentRouteIndex + 1,
            };
          } else {
            // Generate new route when current route is completed
            const randomTarget = INTERSECTIONS[Math.floor(Math.random() * INTERSECTIONS.length)];
            const currentPos = { x: driver.x, y: driver.y };
            const newRoute = generateRoute(currentPos, randomTarget);
            
            return {
              ...driver,
              route: newRoute,
              routeIndex: 0,
            };
          }
        })
      );
    }, 1500); // Move every 1.5 seconds

    return () => clearInterval(interval);
  }, [draggedDriver]);

  // Reset driver to nearest intersection when dragging ends
  useEffect(() => {
    if (draggedDriver === null) {
      setDrivers(prevDrivers =>
        prevDrivers.map(driver => {
          const nearestIntersection = findNearestIntersection(driver.x, driver.y);
          const randomTarget = INTERSECTIONS[Math.floor(Math.random() * INTERSECTIONS.length)];
          const newRoute = generateRoute(nearestIntersection, randomTarget);
          
          return {
            ...driver,
            x: nearestIntersection.x,
            y: nearestIntersection.y,
            route: newRoute,
            routeIndex: 0,
          };
        })
      );
    }
  }, [draggedDriver]);

  const createPanResponder = (driverId: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setDraggedDriver(driverId);
      },
      onPanResponderMove: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        setDrivers(prevDrivers =>
          prevDrivers.map(driver =>
            driver.id === driverId
              ? {
                  ...driver,
                  x: Math.max(20, Math.min(SCREEN_WIDTH - 60, driver.x + dx * 0.5)),
                  y: Math.max(20, Math.min(400, driver.y + dy * 0.5))
                }
              : driver
          )
        );
      },
      onPanResponderRelease: () => {
        setDraggedDriver(null);
      },
    });
  };

  const getDriverStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#10B981';
      case 'busy': return '#F97316';
      case 'offline': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getDriverStatusText = (status: string) => {
    switch (status) {
      case 'available': return 'Müsait';
      case 'busy': return 'Meşgul';
      case 'offline': return 'Çevrimdışı';
      default: return 'Bilinmiyor';
    }
  };

  return (
    <View style={styles.mapContainer}>
      {/* Map Background */}
      <View style={styles.mapBackground}>
        {/* Grid Lines */}
        <View style={styles.gridContainer}>
          {Array.from({ length: 10 }).map((_, i) => (
            <View key={`v-${i}`} style={[styles.gridLineVertical, { left: i * 40 }]} />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={`h-${i}`} style={[styles.gridLineHorizontal, { top: i * 40 }]} />
          ))}
        </View>

        {/* Street Network */}
        {STREET_NETWORK.map((street) => (
          <View
            key={street.id}
            style={[
              street.type === 'main' ? styles.mainRoad : styles.secondaryRoad,
              street.x !== undefined
                ? { left: street.x, top: street.y1, width: street.type === 'main' ? 8 : 4, height: street.y2 - street.y1 }
                : { left: street.x1, top: street.y, width: street.x2 - street.x1, height: street.type === 'main' ? 8 : 4 }
            ]}
          />
        ))}
        
        {/* Intersections */}
        {INTERSECTIONS.map((intersection, index) => (
          <View
            key={index}
            style={[
              styles.intersection,
              { left: intersection.x - 4, top: intersection.y - 4 }
            ]}
          />
        ))}
        
        {/* Buildings */}
        <View style={[styles.building, { top: 30, left: 30, width: 40, height: 40 }]} />
        <View style={[styles.building, { top: 90, left: 140, width: 30, height: 40 }]} />
        <View style={[styles.building, { top: 30, left: 240, width: 30, height: 40 }]} />
        <View style={[styles.building, { top: 30, left: 290, width: 25, height: 40 }]} />
        <View style={[styles.building, { top: 190, left: 30, width: 40, height: 40 }]} />
        <View style={[styles.building, { top: 150, left: 140, width: 30, height: 25 }]} />
        <View style={[styles.building, { top: 190, left: 240, width: 30, height: 40 }]} />
        <View style={[styles.building, { top: 150, left: 290, width: 25, height: 25 }]} />
        <View style={[styles.building, { top: 290, left: 30, width: 40, height: 40 }]} />
        <View style={[styles.building, { top: 290, left: 140, width: 30, height: 40 }]} />
        <View style={[styles.building, { top: 290, left: 240, width: 30, height: 40 }]} />
        <View style={[styles.building, { top: 290, left: 290, width: 25, height: 40 }]} />
        
        {/* Parks */}
        <View style={[styles.park, { top: 90, left: 190, width: 25, height: 25 }]} />
        <View style={[styles.park, { top: 250, left: 190, width: 25, height: 25 }]} />
        
        {/* Street Names */}
        <Text style={[styles.streetName, { top: 85, left: 10 }]}>Atatürk Caddesi</Text>
        <Text style={[styles.streetName, { top: 185, left: 10 }]}>İstiklal Bulvarı</Text>
        <Text style={[styles.streetName, { top: 285, left: 10 }]}>Cumhuriyet Sokak</Text>
        <Text style={[styles.streetName, { top: 20, left: 125, transform: [{ rotate: '90deg' }] }]}>Merkez Cad.</Text>
        <Text style={[styles.streetName, { top: 20, left: 225, transform: [{ rotate: '90deg' }] }]}>Bağdat Cad.</Text>

        {/* Landmarks */}
        <View style={[styles.landmark, { top: 100, left: 100 }]}>
          <MapPin size={16} color="#3B82F6" />
          <Text style={styles.landmarkText}>Belediye</Text>
        </View>
        <View style={[styles.landmark, { top: 200, left: 250 }]}>
          <MapPin size={16} color="#3B82F6" />
          <Text style={styles.landmarkText}>AVM</Text>
        </View>
        <View style={[styles.landmark, { top: 300, left: 150 }]}>
          <MapPin size={16} color="#3B82F6" />
          <Text style={styles.landmarkText}>Hastane</Text>
        </View>
        <View style={[styles.landmark, { top: 100, left: 200 }]}>
          <MapPin size={16} color="#10B981" />
          <Text style={styles.landmarkText}>Park</Text>
        </View>

        {/* Drivers */}
        {drivers.map((driver) => {
          const panResponder = createPanResponder(driver.id);
          return (
            <View
              key={driver.id}
              {...panResponder.panHandlers}
              style={[
                styles.driverMarker,
                {
                  left: driver.x,
                  top: driver.y,
                  transform: [{ scale: draggedDriver === driver.id ? 1.2 : 1 }],
                },
              ]}
            >
              <View style={[
                styles.driverIcon,
                { backgroundColor: getDriverStatusColor(driver.status) }
              ]}>
                <Truck size={16} color="#FFFFFF" />
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{driver.name}</Text>
                <Text style={[
                  styles.driverStatus,
                  { color: getDriverStatusColor(driver.status) }
                ]}>
                  {getDriverStatusText(driver.status)}
                </Text>
              </View>
              {draggedDriver === driver.id && (
                <View style={styles.dragIndicator}>
                  <Text style={styles.dragText}>Sürükle</Text>
                </View>
              )}
              
              {/* Driver route visualization */}
              {driver.route && driver.route.length > 1 && (
                <View style={styles.routeContainer}>
                  {driver.route.slice(driver.routeIndex || 0).map((point, index) => (
                    <View
                      key={index}
                      style={[
                        styles.routePoint,
                        {
                          left: point.x - driver.x,
                          top: point.y - driver.y,
                          opacity: Math.max(0.1, 1 - index * 0.2),
                        }
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* Route Example */}
        <View style={styles.routeExample}>
          <View style={[styles.exampleRoutePoint, { top: 120, left: 100 }]}>
            <View style={styles.pickupPoint}>
              <Text style={styles.routeLabel}>A</Text>
            </View>
          </View>
          <View style={[styles.exampleRoutePoint, { top: 260, left: 280 }]}>
            <View style={styles.deliveryPoint}>
              <Text style={styles.routeLabel}>B</Text>
            </View>
          </View>
          <View style={styles.exampleRouteLine} />
        </View>
      </View>

      {/* Map Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Sürücü Durumu</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Müsait</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F97316' }]} />
            <Text style={styles.legendText}>Meşgul</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendText}>Çevrimdışı</Text>
          </View>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>
          💡 Sürücü ikonlarını sürükleyerek hareket ettirebilirsiniz
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    backgroundColor: '#E0F2FE',
    position: 'relative',
  },
  mapBackground: {
    flex: 1,
    backgroundColor: '#E8F4FD',
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
    backgroundColor: '#F1F5F9',
  },
  mainRoad: {
    position: 'absolute',
    backgroundColor: '#64748B',
    borderRadius: 2,
  },
  secondaryRoad: {
    position: 'absolute',
    backgroundColor: '#94A3B8',
    borderRadius: 1,
  },
  intersection: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#475569',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  building: {
    position: 'absolute',
    backgroundColor: '#CBD5E1',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#94A3B8',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  park: {
    position: 'absolute',
    backgroundColor: '#86EFAC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  streetName: {
    position: 'absolute',
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  landmark: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    gap: 4,
  },
  landmarkText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#1E293B',
  },
  driverMarker: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
  },
  driverIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  driverInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    alignItems: 'center',
  },
  driverName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1F2937',
  },
  driverStatus: {
    fontSize: 8,
    fontWeight: '500',
  },
  dragIndicator: {
    position: 'absolute',
    top: -30,
    backgroundColor: '#1F2937',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dragText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  routeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 5,
  },
  routePoint: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3B82F6',
  },
  routeExample: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  exampleRoutePoint: {
    position: 'absolute',
  },
  pickupPoint: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FCD34D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  deliveryPoint: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  exampleRouteLine: {
    position: 'absolute',
    top: 132,
    left: 112,
    width: 180,
    height: 140,
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    borderRadius: 60,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    transform: [{ rotate: '45deg' }],
  },
  legend: {
    position: 'absolute',
    top: 20,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  legendItems: {
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#6B7280',
  },
  instructions: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  instructionsText: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
    opacity: 0.8,
  },
});