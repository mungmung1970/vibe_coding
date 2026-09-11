import { createContext, useContext, useMemo, useState } from 'react';
import { canAccess, loadSession, login, logout } from '../../services/authService.js';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadSession);
  const value = useMemo(() => ({ user, signIn: (id, password) => { const next = login(id, password); setUser(next); return next; }, signOut: () => { logout(); setUser(null); }, can: (menu, action = 'read') => canAccess(user, menu, action) }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }
