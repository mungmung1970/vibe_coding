import { navigation } from '../data/navigation.js';
import { useAuth } from '../features/auth/AuthContext.jsx';

export default function Layout({ menu, onMenuChange, children }) {
  const { user, can, signOut } = useAuth();
  const visible = navigation.filter(({ permission }) => can(...permission));
  return <div className="shell"><header className="topbar"><div className="brand"><span className="brand-mark">●</span><strong>LLM Lab</strong></div><nav className="tabs" aria-label="주요 메뉴">{visible.map((item) => <button className={`tab ${menu === item.id ? 'is-active' : ''}`} key={item.id} onClick={() => onMenuChange(item.id)}>{item.label}</button>)}</nav><div className="account"><span>{user.name} · {user.role}</span><button onClick={signOut}>로그아웃</button></div></header><div className="workspace"><aside className="sidebar"><SideControls /></aside><main className="content">{children}</main></div></div>;
}

function SideControls() {
  return <><section className="side-section"><h2>모델</h2><label>제공자<select><option>Local (gpt-oss-120b)</option><option>OpenAI</option></select></label><label>모델<select><option>gpt-oss-120b</option><option>chat-latest</option></select></label></section><section className="side-section"><h2>시스템 프롬프트</h2><textarea placeholder="예: 나는 친절한 한국어 비서다." /></section><section className="side-section"><h2>파라미터</h2><label className="check"><input type="checkbox" /> thinking 표시</label><label>reasoning_effort<select><option>low</option><option>medium</option><option>high</option></select></label><label>max_tokens<input defaultValue="8192" /></label><label>temperature<input type="range" defaultValue="30" /></label></section></>;
}
