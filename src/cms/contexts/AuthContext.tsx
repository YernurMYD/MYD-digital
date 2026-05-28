import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { mockAuth } from '../services/mockAuth';
import type { User, AuthState, LoginCredentials, UserRole } from '../types/auth';

interface AuthContextValue extends AuthState {
  login: (creds: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    mockAuth.getSession().then((user) => {
      setState({
        user,
        accessToken: user ? 'mock-token' : null,
        isAuthenticated: !!user,
        isLoading: false,
      });
    });
  }, []);

  const login = useCallback(async (creds: LoginCredentials) => {
    const user = await mockAuth.login(creds.email, creds.password);
    setState({
      user,
      accessToken: 'mock-token',
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(async () => {
    await mockAuth.logout();
    setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!state.user) return false;
      return roles.includes(state.user.role);
    },
    [state.user],
  );

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
