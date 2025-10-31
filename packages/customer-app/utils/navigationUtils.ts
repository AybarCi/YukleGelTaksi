import { router } from 'expo-router';
import { Platform } from 'react-native';

/**
 * Safe navigation back function that handles focus management
 * and accessibility issues on web platform
 */
export const safeGoBack = () => {
  // On web platform, we need to handle focus management properly
  if (Platform.OS === 'web') {
    // Get the currently focused element
    const focusedElement = document.activeElement as HTMLElement;
    
    // If there's a focused element, blur it before navigation
    if (focusedElement) {
      focusedElement.blur();
    }
    
    // Small delay to ensure focus is properly cleared
    setTimeout(() => {
      router.back();
    }, 50);
  } else {
    // On native platforms, just use regular back navigation
    router.back();
  }
};

/**
 * Custom back button component props
 */
export interface CustomBackButtonProps {
  onPress?: () => void;
  style?: any;
}

/**
 * Default back button press handler
 */
export const handleBackPress = (customAction?: () => void) => {
  if (customAction) {
    customAction();
  } else {
    safeGoBack();
  }
};