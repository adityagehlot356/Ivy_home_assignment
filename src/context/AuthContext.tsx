import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/api';
import {
  loginUser,
  logoutUser,
  getCurrentUser,
  isSessionActive,
  setupAutoRefresh,
} from '../services/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(isSessionActive());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const active = isSessionActive();
    setIsAuthenticated(active);
    setUser(getCurrentUser());
    if (active) {
      setupAutoRefresh();
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const resp = await loginUser(email, password);
    setUser(resp.user);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutUser();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
