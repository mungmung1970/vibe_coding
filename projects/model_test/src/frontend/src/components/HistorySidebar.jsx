import { formatDateTime } from '../utils/format.js';
import { useWorkbench } from '../state/WorkbenchContext.jsx';
import { useHistory } from '../features/workbench/HistoryContext.jsx';
import SideSection from './SideSection.jsx';

export default function HistorySidebar() {
  const { models, runs, runsFilter, setRunsFilter, loadRuns } = useWorkbench();
  const { selectedRunIds, hiddenRunIds, toggleSelection, showAllRuns, openContextMenu } = useHistory();
  const visible = runs.filter((run) => !hiddenRunIds.includes(run.id));
  const update = (key) => (event) => setRunsFilter({ ...runsFilter, [key]: event.target.value });

  return (
    <div className="sidebar-inner">
      <SideSection title="검색">
        <label className="field">
          <span className="field-label">모델</span>
          <select value={runsFilter.model_id} aria-label="모델 필터" onChange={update('model_id')}>
            <option value="">전체</option>
            {models.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">prompt</span>
          <input type="search" value={runsFilter.q} placeholder="질문/답변 검색" onChange={update('q')} />
        </label>
        <label className="field">
          <span className="field-label">일자범위</span>
          <input type="date" value={runsFilter.from} aria-label="시작일" onChange={update('from')} />
        </label>
        <label className="field">
          <span className="field-label">&nbsp;</span>
          <input type="date" value={runsFilter.to} aria-label="종료일" onChange={update('to')} />
        </label>
        <div className="side-actions">
          <button type="button" className="mini-btn" onClick={() => loadRuns(runsFilter)}>조회</button>
          {hiddenRunIds.length > 0 && <button type="button" className="mini-btn" onClick={showAllRuns}>숨긴 항목 표시</button>}
        </div>
      </SideSection>

      <SideSection title="리스트" className="side-list">
        {visible.length === 0 ? <p className="side-note">조회된 결과가 없습니다.</p> : visible.map((run) => (
          <button
            key={run.id}
            type="button"
            className={`list-item ${selectedRunIds.includes(run.id) ? 'is-selected' : ''}`}
            onClick={() => toggleSelection(run.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              openContextMenu({ runId: run.id, x: event.clientX, y: event.clientY });
            }}
          >
            <strong>{run.model_id}</strong>
            <span>{formatDateTime(run.created_at)}</span>
            <em>{run.prompt}</em>
          </button>
        ))}
      </SideSection>
    </div>
  );
}
