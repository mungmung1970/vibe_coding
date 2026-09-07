import { useEffect, useState } from 'react';
import RunCard from '../../components/RunCard.jsx';
import CompareDialog from '../../components/CompareDialog.jsx';
import { listRuns } from '../../services/modelService.js';
import { formatDateTime } from '../../utils/format.js';

/** 크롬 탭 모양으로 선택한 결과를 전환하며 본다. 각 탭은 ×로 닫는다. */
function TabView({ runs, selected, activeId, onActivate, onClose, onToggle, onContextMenu }) {
  const chosen = runs.filter((run) => selected.includes(run.id));
  const shown = chosen.length ? chosen : runs.slice(0, 1);
  if (!shown.length) return <p className="answer-placeholder">표시할 결과가 없습니다.</p>;
  const active = shown.find((run) => run.id === activeId) ?? shown[0];

  return (
    <div className="run-tabs">
      <div className="run-tab-strip" role="tablist">
        {shown.map((run) => (
          <div key={run.id} className={`run-tab ${run.id === active.id ? 'is-active' : ''}`} role="tab" aria-selected={run.id === active.id}>
            <button type="button" className="run-tab-label" onClick={() => onActivate(run.id)}>
              <strong>{run.model_id}</strong>
              <small>{formatDateTime(run.created_at)}</small>
            </button>
            <button type="button" className="run-tab-close" title="탭 닫기" aria-label="탭 닫기"
              onClick={(event) => { event.stopPropagation(); onClose(run.id); }}>×</button>
          </div>
        ))}
      </div>
      <div className="run-tab-panel">
        <RunCard run={active} bare selected={selected.includes(active.id)} onToggle={onToggle} onHide={() => {}} onContextMenu={onContextMenu} />
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [runs, setRuns] = useState([]);
  const [selected, setSelected] = useState([]);
  const [hidden, setHidden] = useState([]);
  const [view, setView] = useState('grid');
  const [activeId, setActiveId] = useState('');
  const [menu, setMenu] = useState(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => { listRuns().then(setRuns); }, []);
  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menu]);

  const visible = runs.filter((run) => !hidden.includes(run.id));
  const toggle = (id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const hide = (id) => { setHidden((current) => [...current, id]); setSelected((current) => current.filter((item) => item !== id)); };
  const remove = (id) => { setRuns((current) => current.filter((run) => run.id !== id)); setSelected((current) => current.filter((item) => item !== id)); };
  const closeTab = (id) => (selected.includes(id) ? setSelected(selected.filter((item) => item !== id)) : hide(id));
  const contextMenu = (id) => (event) => { event.preventDefault(); setMenu({ id, x: event.clientX, y: event.clientY }); };

  return (
    <section className="compare-view">
      <div className="toolbar">
        <strong>
          결과 {visible.length}건
          {selected.length > 0 && ` · 선택 ${selected.length}건`}
          {hidden.length > 0 && ` · 숨김 ${hidden.length}건`}
        </strong>
        <div className="toolbar-actions">
          <button type="button" className={`btn ${view === 'tabs' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('tabs')}>탭 보기</button>
          <button type="button" className={`btn ${view === 'tabs' ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setView('grid')}>여러 개 보기</button>
          <button type="button" className="btn btn-secondary" disabled={selected.length < 2} onClick={() => setComparing(true)}>답변 비교</button>
        </div>
      </div>

      {hidden.length > 0 && (
        <p className="side-note"><button type="button" className="link-btn" onClick={() => setHidden([])}>숨긴 {hidden.length}건 다시 표시</button></p>
      )}

      {visible.length === 0 ? (
        <p className="answer-placeholder">저장된 결과가 없습니다. 답변 패널의 저장 버튼을 누르면 여기에 쌓입니다.</p>
      ) : view === 'tabs' ? (
        <TabView
          runs={visible} selected={selected} activeId={activeId}
          onActivate={setActiveId} onClose={closeTab} onToggle={toggle}
          onContextMenu={contextMenu(activeId || visible[0].id)}
        />
      ) : (
        <div className="result-cards">
          {visible.map((run) => (
            <RunCard key={run.id} run={run} selected={selected.includes(run.id)} onToggle={toggle} onHide={hide} onContextMenu={contextMenu(run.id)} />
          ))}
        </div>
      )}

      {comparing && (
        <CompareDialog runs={runs.filter((run) => selected.includes(run.id))} onClose={() => setComparing(false)} />
      )}
      {menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
          <button type="button" role="menuitem" onClick={() => { setMenu(null); remove(menu.id); }}>삭제</button>
        </div>
      )}
    </section>
  );
}
