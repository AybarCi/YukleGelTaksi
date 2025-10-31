import React from 'react';
import { TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { safeGoBack } from '../utils/navigationUtils';

interface BackButtonProps {
  onPress?: () => void;
  style?: any;
  color?: string;
  size?: number;
}

/**
 * Safe Back Button component that handles focus management
 * and prevents aria-hidden accessibility issues on web platform
 */
export const BackButton: React.FC<BackButtonProps> = ({ 
  onPress, 
  style, 
  color = '#000000', 
  size = 24 
}) => {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      safeGoBack();
    }
  };

  return (
    <TouchableOpacity 
      onPress={handlePress}
      style={style}
      // Ensure proper accessibility handling
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Geri"
    >
      <Ionicons name="arrow-back" size={size} color={color} />
    </TouchableOpacity>
  );
};

export default BackButton;