import { useEffect } from 'react';
import { useWorkbench } from '../../state/WorkbenchContext.jsx';
import { useHistory } from './HistoryContext.jsx';
import RunCard from '../../components/RunCard.jsx';
import CompareDialog from '../../components/CompareDialog.jsx';
import { formatDateTime } from '../../utils/format.js';

/** 크롬 탭 모양으로 선택한 답변을 전환하며 본다. */
function TabView({ runs, history }) {
  const { selectedRunIds, activeRunId, setActiveRunId, closeTab, toggleSelection, openContextMenu } = history;
  const chosen = runs.filter((run) => selectedRunIds.includes(run.id));
  const shown = chosen.length ? chosen : runs.slice(0, 1);
  if (!shown.length) return <p className="answer-placeholder">표시할 결과가 없습니다.</p>;

  const activeId = shown.some((run) => run.id === activeRunId) ? activeRunId : shown[0].id;
  const active = shown.find((run) => run.id === activeId);

  return (
    <div className="run-tabs">
      <div className="run-tab-strip" role="tablist">
        {shown.map((run) => (
          <div key={run.id} className={`run-tab ${run.id === activeId ? 'is-active' : ''}`} role="tab" aria-selected={run.id === activeId}>
            <button type="button" className="run-tab-label" onClick={() => setActiveRunId(run.id)}>
              <strong>{run.model_id}</strong>
              <small>{formatDateTime(run.created_at)}</small>
            </button>
            <button
              type="button"
              className="run-tab-close"
              title="탭 닫기"
              aria-label="탭 닫기"
              onClick={(event) => { event.stopPropagation(); closeTab(run.id); }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="run-tab-panel">
        <RunCard
          run={active}
          bare
          selected={selectedRunIds.includes(active.id)}
          onToggle={toggleSelection}
          onHide={() => {}}
          onContextMenu={(event) => {
            event.preventDefault();
            openContextMenu({ runId: active.id, x: event.clientX, y: event.clientY });
          }}
        />
      </div>
    </div>
  );
}

function ContextMenu({ menu, onDelete, onClose }) {
  return (
    <div className="context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
      <button type="button" role="menuitem" onClick={() => { onClose(); onDelete(menu.runId); }}>삭제</button>
    </div>
  );
}

export default function HistoryPage() {
  const { runs, runsError, loadRuns, deleteRun, loadJudges } = useWorkbench();
  const history = useHistory();
  const {
    selectedRunIds, hiddenRunIds, historyView, comparison, contextMenu,
    setHistoryView, toggleSelection, hideRun, openCompare, openContextMenu, closeContextMenu,
  } = history;

  // 비교 모델 목록은 화면에 들어올 때 미리 받아둔다. 비교 창을 열 때 비어 보이지 않게.
  useEffect(() => { loadRuns(); loadJudges(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!contextMenu) return undefined;
    const close = () => closeContextMenu();
    const onKey = (event) => { if (event.key === 'Escape') closeContextMenu(); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', onKey); };
  }, [contextMenu, closeContextMenu]);

  const visible = runs.filter((run) => !hiddenRunIds.includes(run.id));

  return (
    <section className="compare-view">
      <div className="toolbar">
        <strong>
          결과 {visible.length}건
          {selectedRunIds.length > 0 && ` · 선택 ${selectedRunIds.length}건`}
          {hiddenRunIds.length > 0 && ` · 숨김 ${hiddenRunIds.length}건`}
        </strong>
        <div className="toolbar-actions">
          <button type="button" className={`btn ${historyView === 'tabs' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setHistoryView('tabs')}>탭 보기</button>
          <button type="button" className={`btn ${historyView === 'tabs' ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setHistoryView('grid')}>여러 개 보기</button>
          <button type="button" className="btn btn-secondary" disabled={selectedRunIds.length < 2} onClick={openCompare}>답변 비교</button>
        </div>
      </div>
      {runsError && <p className="side-error">{runsError}</p>}

      <div className="result-body">
        {visible.length === 0 ? (
          <p className="answer-placeholder">저장된 실행 결과가 없습니다. 답변 패널의 저장 버튼을 누르면 여기에 쌓입니다.</p>
        ) : historyView === 'tabs' ? (
          <TabView runs={visible} history={history} />
        ) : (
          <div className="result-cards">
            {visible.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                selected={selectedRunIds.includes(run.id)}
                onToggle={toggleSelection}
                onHide={hideRun}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openContextMenu({ runId: run.id, x: event.clientX, y: event.clientY });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {comparison && <CompareDialog />}
      {contextMenu && <ContextMenu menu={contextMenu} onDelete={deleteRun} onClose={closeContextMenu} />}
    </section>
  );
}

