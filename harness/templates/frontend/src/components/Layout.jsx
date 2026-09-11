import { useCallback, useEffect, useRef, useState } from 'react';
import { ANONYMOUS_USER, NAVIGATION } from '../data/defaults.js';
import { useWorkbench } from '../state/WorkbenchContext.jsx';
import PromptSidebar from './PromptSidebar.jsx';
import HistorySidebar from './HistorySidebar.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';

const MIN_WIDTH = 160;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 208;
const STORE_KEY = 'llmlab.sidebar';

/** 접힘 상태와 폭을 브라우저에 기억한다. 못 읽어도 기본값으로 뜬다. */
function useSidebarLayout() {
  const [state, setState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
      return {
        width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(saved.width) || DEFAULT_WIDTH)),
        collapsed: Boolean(saved.collapsed),
      };
    } catch {
      return { width: DEFAULT_WIDTH, collapsed: false };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch { /* 사생활 보호 모드 등에서 저장이 막혀도 화면은 그대로 쓴다 */ }
  }, [state]);

  return [state, setState];
}

export default function Layout({ menu, onMenuChange, children }) {
  const { user, can, signOut } = useAuth();
  const { notice } = useWorkbench();
  const [{ width, collapsed }, setLayout] = useSidebarLayout();
  const dragging = useRef(false);

  const toggle = () => setLayout((current) => ({ ...current, collapsed: !current.collapsed }));

  const clamp = useCallback((value) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value)), []);

  useEffect(() => {
    const move = (event) => {
      if (!dragging.current) return;
      event.preventDefault();
      setLayout((current) => ({ ...current, width: clamp(event.clientX) }));
    };
    const stop = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.classList.remove('is-resizing');
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); };
  }, [clamp, setLayout]);

  return (
    <div className="shell" style={{ '--sidebar-width': collapsed ? '0px' : `${width}px` }}>
      <header className="topbar">
        <button
          type="button"
          className="sidebar-toggle"
          title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          aria-expanded={!collapsed}
          onClick={toggle}
        >{collapsed ? '»' : '«'}</button>
        <div className="brand"><span className="brand-mark">●</span><strong>LLM Lab</strong></div>
        <nav className="tabs" aria-label="주요 메뉴">
          {NAVIGATION.filter((item) => can(item.id)).map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tab ${menu === item.id ? 'is-active' : ''}`}
              onClick={() => onMenuChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <span className="user-badge" title="현재 로그인 ID">
            <span className="user-icon" aria-hidden="true">●</span>{user?.id ?? ANONYMOUS_USER}
          </span>
          <button type="button" className="btn btn-secondary" onClick={signOut}>로그아웃</button>
        </div>
      </header>
      <div className={`workspace ${collapsed ? 'is-collapsed' : ''}`}>
        <aside className="sidebar" hidden={collapsed}>
          {menu === 'history' ? <HistorySidebar /> : menu === 'admin' ? null : <PromptSidebar />}
        </aside>
        {!collapsed && (
          // 드래그로 폭 조절. 더블클릭하면 기본 폭으로 돌아온다.
          <div
            className="sidebar-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="사이드바 폭 조절"
            title="드래그로 폭 조절 · 더블클릭으로 기본 폭"
            onMouseDown={() => { dragging.current = true; document.body.classList.add('is-resizing'); }}
            onDoubleClick={() => setLayout((current) => ({ ...current, width: DEFAULT_WIDTH }))}
          />
        )}
        <main className="content">{children}</main>
      </div>
      {notice && <div className="notice" role="status">{notice}</div>}
    </div>
  );
}
