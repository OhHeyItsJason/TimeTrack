import React, { createContext, useState, useContext, useEffect } from 'react';
import { appClient } from '@/api/appClient';

const AuthContext = createContext();
const GENERIC_LOGIN_ERROR = 'Incorrect email or password.';

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
      // Local mode metadata
      setAppPublicSettings({
        id: 'local-timetrack-app',
        public_settings: {
          requires_auth: true,
        },
      });
      setIsLoadingPublicSettings(false);

      const currentUser = await appClient.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      if (error && (error.status === 401 || error.status === 403)) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
      } else {
        setAuthError({
          type: 'unknown',
          message: error && error.message ? error.message : 'Unable to verify authentication',
        });
      }
      setIsLoadingAuth(false);
    }
  };

  const login = async (email, password) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      await appClient.auth.login(email, password);
      await checkAppState();
      return { ok: true };
    } catch (error) {
      setIsLoadingAuth(false);
      setAuthError({
        type: 'auth_required',
        message: GENERIC_LOGIN_ERROR,
      });
      return {
        ok: false,
        message: GENERIC_LOGIN_ERROR,
      };
    }
  };

  const logout = () => {
    appClient.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
    setAuthError({
      type: 'auth_required',
      message: 'Authentication required',
    });
  };

  const navigateToLogin = () => {
    // Login UI is rendered by App when auth is required.
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
        login,
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
