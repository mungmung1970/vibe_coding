import { ANONYMOUS_USER, NAVIGATION } from '../data/defaults.js';
import { useWorkbench } from '../state/WorkbenchContext.jsx';
import PromptSidebar from './PromptSidebar.jsx';
import HistorySidebar from './HistorySidebar.jsx';

export default function Layout({ menu, onMenuChange, children }) {
  const { notice } = useWorkbench();
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">●</span><strong>LLM Lab</strong></div>
        <nav className="tabs" aria-label="주요 메뉴">
          {NAVIGATION.map((item) => (
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
          <span className="user-badge" title="로그인 사용자">
            <span className="user-icon" aria-hidden="true">●</span>{ANONYMOUS_USER}
          </span>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          {menu === 'history' ? <HistorySidebar /> : <PromptSidebar />}
        </aside>
        <main className="content">{children}</main>
      </div>
      {notice && <div className="notice" role="status">{notice}</div>}
    </div>
  );
}
