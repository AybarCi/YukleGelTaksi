import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { store } from '../store';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../contexts/AuthContext';

// Crypto polyfill for React Native
if (typeof global !== 'undefined' && !global.crypto) {
  global.crypto = require('expo-crypto');
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="splash" />
              <Stack.Screen name="phone-auth" />
              <Stack.Screen name="verify-code" />
              <Stack.Screen name="home" />
              <Stack.Screen name="order-detail" />
              <Stack.Screen name="driver-dashboard" />
              <Stack.Screen name="payment" />
            </Stack>
            <StatusBar style="auto" />
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </AuthProvider>
    </Provider>
  );
}
