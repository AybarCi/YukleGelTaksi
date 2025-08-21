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
      
      if (user && token) {
        // User is authenticated
        if (user.user_type === 'driver') {
          // For drivers, check their status and navigate accordingly
          // For now, navigate to driver-dashboard (can be enhanced later)
          setTimeout(() => {
            router.replace('/driver-dashboard');
          }, 100);
        } else {
          // For passengers, check if profile is complete
          if (!user.full_name || user.full_name.trim().length === 0) {
            setTimeout(() => {
              router.replace('/user-info');
            }, 100);
          } else {
            setTimeout(() => {
              router.replace('/home');
            }, 100);
          }
        }
      } else {
        // User is not authenticated
        setTimeout(() => {
          router.replace('/splash');
        }, 100);
      }
    }
  }, [user, token, isLoading, hasNavigated]);

  if (isLoading || hasNavigated) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FCD34D" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

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