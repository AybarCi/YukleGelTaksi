import { Stack, Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';

// Crypto polyfill for React Native
if (typeof global !== 'undefined' && !global.crypto) {
  global.crypto = require('expo-crypto');
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Slot />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
