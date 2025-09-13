import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Crypto polyfill for React Native
if (typeof global !== 'undefined' && !global.crypto) {
  global.crypto = require('expo-crypto');
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="splash" />
            <Stack.Screen name="phone-auth" />
            <Stack.Screen name="verify-code" />
            <Stack.Screen name="home" />
            <Stack.Screen name="driver-dashboard" />
          </Stack>
          <StatusBar style="auto" />
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
