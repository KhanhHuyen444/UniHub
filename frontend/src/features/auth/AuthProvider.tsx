import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import {
  getAuthSnapshot,
  subscribeToAuth,
  type AuthSnapshot,
} from './auth-state';
import {
  loginWithGoogleIdToken,
  logoutCurrentSession,
  restoreAuthSession,
} from './auth-api';

interface AuthContextValue extends AuthSnapshot {
  loginWithGoogleIdToken(idToken: string): Promise<void>;
  logout(): Promise<void>;
  retryRestore(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    getAuthSnapshot,
  );

  useEffect(() => {
    void restoreAuthSession();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...snapshot,
      loginWithGoogleIdToken,
      logout: logoutCurrentSession,
      retryRestore: restoreAuthSession,
    }),
    [snapshot],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải nằm trong AuthProvider.');
  return value;
}
