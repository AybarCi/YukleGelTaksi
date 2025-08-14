import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LoadingIndicatorProps {
  visible: boolean;
  text?: string;
  showLogo?: boolean;
}

export default function LoadingIndicator({ 
  visible, 
  text = 'Yükleniyor...', 
  showLogo = true 
}: LoadingIndicatorProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {showLogo && (
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="car" size={32} color="#000000" />
              </View>
            </View>
          )}
          
          <ActivityIndicator 
            size="large" 
            color="#FCD34D" 
            style={styles.spinner}
          />
          
          <Text style={styles.text}>{text}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FCD34D',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#FCD34D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  spinner: {
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
});