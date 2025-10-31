import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationStep, NavigationUpdate } from '../services/navigationService';

interface NavigationInstructionsProps {
  isVisible: boolean;
  currentStep: NavigationStep | null;
  nextStep: NavigationStep | null;
  distanceToDestination: number;
  timeToDestination: number;
  isNavigating: boolean;
  onCloseNavigation: () => void;
  onVoiceToggle: () => void;
  voiceEnabled: boolean;
}

export default function NavigationInstructions({
  isVisible,
  currentStep,
  nextStep,
  distanceToDestination,
  timeToDestination,
  isNavigating,
  onCloseNavigation,
  onVoiceToggle,
  voiceEnabled,
}: NavigationInstructionsProps) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(100));

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)} sn`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} dk`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} sa ${remainingMinutes} dk`;
  };

  const getManeuverIcon = (maneuver: string): string => {
    if (maneuver.includes('turn-left')) return 'arrow-back';
    if (maneuver.includes('turn-right')) return 'arrow-forward';
    if (maneuver.includes('straight')) return 'arrow-up';
    if (maneuver.includes('roundabout')) return 'refresh';
    if (maneuver.includes('merge')) return 'swap-horizontal';
    if (maneuver.includes('ramp')) return 'trending-up';
    return 'navigate';
  };

  const getManeuverColor = (maneuver: string): string => {
    if (maneuver.includes('turn-left')) return '#F59E0B';
    if (maneuver.includes('turn-right')) return '#10B981';
    if (maneuver.includes('straight')) return '#3B82F6';
    if (maneuver.includes('roundabout')) return '#8B5CF6';
    return '#6B7280';
  };

  if (!isVisible || !currentStep) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="navigate" size={20} color="#3B82F6" />
          <Text style={styles.headerTitle}>Navigasyon</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onVoiceToggle} style={styles.voiceButton}>
            <Ionicons 
              name={voiceEnabled ? "volume-high" : "volume-off"} 
              size={20} 
              color={voiceEnabled ? "#10B981" : "#6B7280"} 
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onCloseNavigation} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Current Step */}
      <View style={styles.currentStepContainer}>
        <View style={styles.maneuverIconContainer}>
          <Ionicons 
          name={getManeuverIcon(currentStep.maneuver) as any} 
          size={32} 
          color={getManeuverColor(currentStep.maneuver)} 
        />
        </View>
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText} numberOfLines={2}>
            {currentStep.instruction}
          </Text>
          <Text style={styles.distanceText}>
            {currentStep.distance}
          </Text>
        </View>
      </View>

      {/* Next Step Preview */}
      {nextStep && (
        <View style={styles.nextStepContainer}>
          <View style={styles.nextStepIcon}>
            <Ionicons 
              name={getManeuverIcon(nextStep.maneuver) as any} 
              size={16} 
              color={getManeuverColor(nextStep.maneuver)} 
            />
          </View>
          <Text style={styles.nextStepText} numberOfLines={1}>
            Sonra: {nextStep.instruction}
          </Text>
        </View>
      )}

      {/* Destination Info */}
      <View style={styles.destinationInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="flag" size={16} color="#EF4444" />
          <Text style={styles.infoText}>
            Hedefe: {formatDistance(distanceToDestination)}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time" size={16} color="#6B7280" />
          <Text style={styles.infoText}>
            Tahmini varış: {formatTime(timeToDestination)}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.max(0, 100 - (distanceToDestination / 1000))}%` }]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceButton: {
    marginRight: 8,
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  currentStepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  maneuverIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instructionContainer: {
    flex: 1,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    lineHeight: 22,
  },
  distanceText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  nextStepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  nextStepIcon: {
    marginRight: 8,
  },
  nextStepText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
  },
  destinationInfo: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 8,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
});