import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    setIsLoadingPublicSettings(true);
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      // Local mode: app metadata is static and auth is optional.
      setAppPublicSettings({
        id: 'local-timetrack-app',
        public_settings: {
          requires_auth: false,
        },
      });
      setIsLoadingPublicSettings(false);

      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      // Keep app usable locally even if auth endpoint is temporarily unavailable.
      setUser({ id: 'local-user', name: 'Local User', role: 'admin' });
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    }
  };

  const logout = () => {
    base44.auth.logout();
    setUser({ id: 'local-user', name: 'Local User', role: 'admin' });
    setIsAuthenticated(true);
  };

  const navigateToLogin = () => {
    // Local mode: no external login redirect.
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
