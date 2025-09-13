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
      
      // Tüm kullanıcıları önce splash screen'e yönlendir
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
});