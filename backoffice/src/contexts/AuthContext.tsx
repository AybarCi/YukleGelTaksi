import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/authService';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  
  const authService = useMemo(() => new AuthService(), []);

  // Force logout function for axios interceptor
  const forceLogout = useCallback(() => {
    setUser(null);
    setToken(null);
    authService.logout();
    navigate('/login', { replace: true });
  }, [navigate, authService]);

  // Initialize on mount
  useEffect(() => {
    // Setup axios interceptors
    authService.setupAxiosInterceptors(forceLogout);
    
    // Load user data from localStorage
    const storedToken = authService.getToken();
    const storedUser = authService.getSupervisor();
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
    }
    
    setIsLoading(false);
  }, [authService, forceLogout]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const result = await authService.login({ username, password });
      
      if (result.success) {
        setUser(result.supervisor);
        setToken(result.token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
      setToken(null);
      navigate('/login', { replace: true });
    }
  };

  const value = {
    user,
    token,
    login,
    logout,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};