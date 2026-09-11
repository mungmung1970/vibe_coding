import { useState } from 'react';
import { listUsers } from '../../services/authService.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function AdminPage() {
  const { can } = useAuth();
  const [users, setUsers] = useState(listUsers);
  const editable = can('admin', 'manage');
  const changeRole = (id, role) => setUsers((current) => current.map((user) => user.id === id ? { ...user, role } : user));
  return <section className="admin-page"><div className="toolbar"><div><h1>관리자</h1><p>사용자와 메뉴 권한 템플릿</p></div></div><div className="panel admin-panel">
    <table><thead><tr><th>로그인 ID</th><th>이름</th><th>역할</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.id}</td><td>{user.name}</td><td>{editable ? <select value={user.role} onChange={(event) => changeRole(user.id, event.target.value)}><option value="admin">admin</option><option value="operator">operator</option><option value="viewer">viewer</option></select> : user.role}</td></tr>)}</tbody></table>
    <p className="side-note">실서비스에서는 서버 세션/RBAC를 기준으로 권한을 검증하세요.</p>
  </div></section>;
}
