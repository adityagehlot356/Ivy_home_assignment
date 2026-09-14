import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/api';
import {
  loginUser,
  logoutUser,
  getCurrentUser,
  isSessionActive,
  setupAutoRefresh,
} from '../services/auth';
import { getStoredApiKey, setStoredApiKey } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  apiKey: string;
  login: (email: string, password: string, apiKeyOverride?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateApiKey: (key: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(isSessionActive());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiKey, setApiKey] = useState<string>(getStoredApiKey());

  useEffect(() => {
    const active = isSessionActive();
    setIsAuthenticated(active);
    setUser(getCurrentUser());
    if (active) {
      setupAutoRefresh();
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, apiKeyOverride?: string) => {
    setIsLoading(true);
    try {
      const resp = await loginUser(email, password, apiKeyOverride);
      setUser(resp.user);
      setIsAuthenticated(true);
      if (apiKeyOverride) {
        setApiKey(apiKeyOverride);
      }
    } finally {
      setIsLoading(false);
    }
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

  const updateApiKey = (key: string) => {
    setStoredApiKey(key);
    setApiKey(key);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        apiKey,
        login,
        logout,
        updateApiKey,
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
