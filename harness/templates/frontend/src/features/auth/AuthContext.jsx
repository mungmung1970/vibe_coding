import { createContext, useContext, useMemo, useState } from 'react';
import { login } from '../../services/authService.js';

const rolePermissions = {
  admin: { prompt: ['read', 'manage'], result: ['read', 'manage'], admin: ['read', 'manage'] },
  operator: { prompt: ['read', 'manage'], result: ['read', 'manage'], admin: ['read'] },
  viewer: { prompt: ['read'], result: ['read'], admin: [] },
};
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const value = useMemo(() => ({
    user,
    signIn: async (email, password) => setUser(await login(email, password)),
    signOut: () => setUser(null),
    can: (menu, action = 'read') => Boolean(user && rolePermissions[user.role]?.[menu]?.includes(action)),
  }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
