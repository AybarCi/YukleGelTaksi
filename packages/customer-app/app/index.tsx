import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const { user, token, isLoading } = useAuth();
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    if (!isLoading && !hasNavigated) {
      setHasNavigated(true);
      
      // Her zaman önce splash screen'e git
      setTimeout(() => {
        router.replace('/splash');
      }, 100);
    }
  }, [isLoading, hasNavigated]);

  // Loading sırasında hiçbir şey gösterme, direkt splash'e git
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 16,
  },
});