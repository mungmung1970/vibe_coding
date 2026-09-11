const STORAGE_KEY = 'llm-lab.auth';
const USERS = [
  { id: 'admin@example.com', name: 'Admin', role: 'admin' },
  { id: 'operator@example.com', name: 'Operator', role: 'operator' },
  { id: 'viewer@example.com', name: 'Viewer', role: 'viewer' },
];

export const ROLE_PERMISSIONS = {
  admin: { prompt: 'manage', history: 'manage', admin: 'manage' },
  operator: { prompt: 'manage', history: 'manage', admin: 'read' },
  viewer: { prompt: 'read', history: 'read' },
};
export const listUsers = () => USERS.map((user) => ({ ...user }));
export function login(id, password) {
  const user = USERS.find((candidate) => candidate.id === id.trim());
  if (!user || password !== 'admin') throw new Error('로그인 ID 또는 비밀번호가 올바르지 않습니다.');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}
export function loadSession() { try { const user = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); return user?.id && user?.role ? user : null; } catch { return null; } }
export function logout() { localStorage.removeItem(STORAGE_KEY); }
export function canAccess(user, menu, action = 'read') { const permission = ROLE_PERMISSIONS[user?.role]?.[menu]; return permission === 'manage' || (action === 'read' && permission === 'read'); }
