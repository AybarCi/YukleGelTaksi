import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '../contexts/AuthContext';

// Crypto polyfill for web
if (typeof global !== 'undefined' && !global.crypto) {
  global.crypto = require('expo-crypto');
}
if (typeof window !== 'undefined' && !window.crypto) {
  window.crypto = require('expo-crypto');
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="splash" />
        <Stack.Screen name="phone-auth" />
        <Stack.Screen name="verify-code" />
        <Stack.Screen name="user-info" />
        <Stack.Screen name="email-info" />
        <Stack.Screen name="home" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
