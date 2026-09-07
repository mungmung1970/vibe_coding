import { useEffect, useState } from 'react';
import Layout from './components/Layout.jsx';
import { HistoryProvider } from './features/workbench/HistoryContext.jsx';
import PromptPage from './features/workbench/PromptPage.jsx';
import HistoryPage from './features/workbench/HistoryPage.jsx';

export default function App() {
  const requested = new URLSearchParams(window.location.search).get('tab');
  const [menu, setMenu] = useState(requested === 'history' ? 'history' : 'prompt');

  useEffect(() => {
    document.title = menu === 'history' ? 'LLM Lab · 결과 조회' : 'LLM Lab · 프롬프트 테스트';
  }, [menu]);

  // 결과 조회 상태(선택·숨김·탭·비교)는 사이드바와 본문이 함께 쓰므로 Layout 바깥에서 제공한다.
  return (
    <HistoryProvider>
      <Layout menu={menu} onMenuChange={setMenu}>
        {menu === 'history' ? <HistoryPage /> : <PromptPage />}
      </Layout>
    </HistoryProvider>
  );
}
