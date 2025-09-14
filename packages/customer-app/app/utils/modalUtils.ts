import { Alert } from 'react-native';

export const showModal = (
  title: string, 
  message: string, 
  type: 'success' | 'error' | 'info' | 'warning'
) => {
  Alert.alert(title, message);
};