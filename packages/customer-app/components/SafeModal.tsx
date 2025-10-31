import React, { useEffect, useRef } from 'react';
import { Modal, ModalProps, Platform } from 'react-native';

interface SafeModalProps extends ModalProps {
  onRequestClose: () => void;
}

/**
 * Safe Modal component that handles focus management
 * and prevents aria-hidden accessibility issues on web platform
 */
export const SafeModal: React.FC<SafeModalProps> = ({ 
  visible, 
  onRequestClose, 
  children, 
  ...props 
}) => {
  const wasVisibleRef = useRef(visible);

  useEffect(() => {
    // Handle focus management when modal visibility changes
    if (Platform.OS === 'web' && visible !== wasVisibleRef.current) {
      if (visible) {
        // Modal is opening - store current focused element
        const focusedElement = document.activeElement as HTMLElement;
        if (focusedElement) {
          // Blur the focused element to prevent aria-hidden issues
          focusedElement.blur();
        }
      } else {
        // Modal is closing - clear any focus
        const focusedElement = document.activeElement as HTMLElement;
        if (focusedElement) {
          focusedElement.blur();
        }
      }
      wasVisibleRef.current = visible;
    }
  }, [visible]);

  const handleRequestClose = () => {
    // Ensure focus is cleared before closing
    if (Platform.OS === 'web') {
      const focusedElement = document.activeElement as HTMLElement;
      if (focusedElement) {
        focusedElement.blur();
      }
      // Small delay to ensure focus is properly cleared
      setTimeout(() => {
        onRequestClose();
      }, 50);
    } else {
      onRequestClose();
    }
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={handleRequestClose}
      {...props}
    >
      {children}
    </Modal>
  );
};

export default SafeModal;