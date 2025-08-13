import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import SMSLoginScreen from '../screens/auth/SMSLoginScreen';
import SMSVerificationScreen from '../screens/auth/SMSVerificationScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  SMSLogin: undefined;
  SMSVerification: {
    phone: string;
  };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: 'slide_from_right',
      }}
      initialRouteName="Login"
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="SMSLogin" component={SMSLoginScreen} />
      <Stack.Screen name="SMSVerification" component={SMSVerificationScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;