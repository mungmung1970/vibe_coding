import { useEffect, useState } from 'react';
import Layout from './components/Layout.jsx';
import { HistoryProvider } from './features/workbench/HistoryContext.jsx';
import PromptPage from './features/workbench/PromptPage.jsx';
import HistoryPage from './features/workbench/HistoryPage.jsx';
import AdminPage from './features/admin/AdminPage.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import { AuthProvider, useAuth } from './features/auth/AuthContext.jsx';

export default function App() { return <AuthProvider><AuthenticatedApp /></AuthProvider>; }

function AuthenticatedApp() {
  const { user, can } = useAuth();
  if (!user) return <LoginPage />;
  const requested = new URLSearchParams(window.location.search).get('tab');
  const initialMenu = requested === 'admin' && can('admin') ? 'admin' : requested === 'history' ? 'history' : 'prompt';
  const [menu, setMenu] = useState(initialMenu);
  useEffect(() => { document.title = menu === 'admin' ? 'LLM Lab · 관리자' : menu === 'history' ? 'LLM Lab · 결과 조회' : 'LLM Lab · 프롬프트 테스트'; }, [menu]);
  return <HistoryProvider><Layout menu={menu} onMenuChange={setMenu}>
    {menu === 'history' ? <HistoryPage /> : menu === 'admin' ? <AdminPage /> : <PromptPage />}
  </Layout></HistoryProvider>;
}
