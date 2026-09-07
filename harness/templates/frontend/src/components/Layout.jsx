import { useEffect, useState } from 'react';
import { navigation } from '../data/navigation.js';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { listModels } from '../services/modelService.js';
import { modelLabel } from '../utils/format.js';
import SideSection from './SideSection.jsx';

export default function Layout({ menu, onMenuChange, children }) {
  const { user, can, signOut } = useAuth();
  const visible = navigation.filter(({ permission }) => can(...permission));
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">●</span><strong>LLM Lab</strong></div>
        <nav className="tabs" aria-label="주요 메뉴">
          {visible.map((item) => (
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
          {/* 상단 우측은 로그인 ID를 보여준다. 로그인 전에는 anonymous. */}
          <span className="user-badge" title={`역할: ${user?.role ?? '-'}`}>
            <span className="user-icon" aria-hidden="true">●</span>{user?.email ?? 'anonymous'}
          </span>
          {user && <button type="button" className="link-btn" onClick={signOut}>로그아웃</button>}
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">{menu === 'admin' ? null : <SideControls />}</aside>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

/** 모델·시스템 프롬프트·파라미터. 모든 상자는 접고 펼 수 있다. */
function SideControls() {
  const [models, setModels] = useState([]);
  const [modality, setModality] = useState('');
  const [provider, setProvider] = useState('');
  const [temperature, setTemperature] = useState(0.3);

  useEffect(() => { listModels(modality).then(setModels); }, [modality]);

  const providers = [...new Set(models.map((model) => model.provider))];
  const inProvider = models.filter((model) => !provider || model.provider === provider);

  return (
    <div className="sidebar-inner">
      <SideSection title="모델">
        <label className="field">
          <span className="field-label">모델 유형</span>
          <select value={modality} aria-label="모델 유형 필터" onChange={(event) => setModality(event.target.value)}>
            <option value="">전체</option>
            <option value="LLM">LLM (텍스트)</option>
            <option value="VLM">VLM (텍스트+이미지)</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">제공자</span>
          <select value={provider} aria-label="제공자" onChange={(event) => setProvider(event.target.value)}>
            <option value="">전체</option>
            {providers.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">모델</span>
          <select aria-label="모델">
            {inProvider.map((model) => <option key={model.id} value={model.id}>{modelLabel(model)}</option>)}
          </select>
        </label>
      </SideSection>

      <SideSection title="시스템 프롬프트">
        <textarea aria-label="시스템 프롬프트" placeholder="예: 나는 친절한 한국어 비서다." />
      </SideSection>

      <SideSection title="파라미터">
        <label className="check"><input type="checkbox" /> <span>thinking 표시</span></label>
        <label className="field">
          <span className="field-label">reasoning_effort</span>
          <select aria-label="reasoning_effort"><option>low</option><option>medium</option><option>high</option></select>
        </label>
        <label className="field">
          <span className="field-label">max_tokens</span>
          <input type="number" defaultValue="8192" aria-label="max_tokens" />
        </label>
        <label className="field">
          <span className="field-label">temperature<b className="field-value">{temperature}</b></span>
          <input
            type="range" min="0" max="2" step="0.01" value={temperature} aria-label="temperature"
            onChange={(event) => setTemperature(Number(event.target.value))}
          />
        </label>
      </SideSection>
    </div>
  );
}
