import { useState } from 'react';
import { useAuth } from './features/auth/AuthContext.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import AdminPage from './features/admin/AdminPage.jsx';
import PromptPage from './features/workbench/PromptPage.jsx';
import ComparePage from './features/workbench/ComparePage.jsx';
import Layout from './components/Layout.jsx';

export default function App() {
  const { user, can } = useAuth();
  const [menu, setMenu] = useState('prompt');
  if (!user) return <LoginPage />;
  return <Layout menu={menu} onMenuChange={setMenu}>
    {menu === 'admin' && can('admin', 'read') ? <AdminPage canManage={can('admin', 'manage')} /> : menu === 'compare' ? <ComparePage /> : <PromptPage />}
  </Layout>;
}
