import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const { user, token, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user && token) {
        router.replace('/home');
      } else {
        router.replace('/splash');
      }
    }
  }, [user, token, isLoading]);

  if (isLoading) {
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