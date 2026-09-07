import { STATUS_LABELS } from '../data/defaults.js';
import { useWorkbench } from '../state/WorkbenchContext.jsx';
import SideSection from './SideSection.jsx';
import ParameterControl from './ParameterControl.jsx';

export default function PromptSidebar() {
  const {
    models, providers, modalityFilter, selectedProvider, selectedModelId, modelsError,
    serving, servingLogs, showLogs, schema, parameters, systemPrompt,
    setModalityFilter, setSelectedProvider, selectModel, stopServing, toggleLogs,
    setParameter, resetParameters, setSystemPrompt,
  } = useWorkbench();

  const inProvider = models.filter((model) => !selectedProvider || model.provider === selectedProvider);
  const busy = serving.status === 'ready' || serving.status === 'starting';

  return (
    <div className="sidebar-inner">
      <SideSection title="모델">
        <label className="field">
          <span className="field-label">모델 유형</span>
          <select value={modalityFilter} aria-label="모델 유형 필터" onChange={(event) => setModalityFilter(event.target.value)}>
            <option value="">전체</option>
            <option value="LLM">LLM (텍스트)</option>
            <option value="VLM">VLM (텍스트+이미지)</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">제공자</span>
          <select value={selectedProvider} aria-label="제공자" onChange={(event) => setSelectedProvider(event.target.value)}>
            {providers.length ? providers.map((provider) => <option key={provider} value={provider}>{provider}</option>)
              : <option value="">-</option>}
          </select>
        </label>
        <label className="field">
          <span className="field-label">모델</span>
          <select value={selectedModelId} aria-label="모델" onChange={(event) => selectModel(event.target.value)}>
            {inProvider.length ? inProvider.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)
              : <option value="">모델 없음</option>}
          </select>
        </label>

        <div className={`serving-status status-${serving.status}`}>
          <span className="status-dot" aria-hidden="true" />
          <span className="status-text">{STATUS_LABELS[serving.status] ?? serving.status}</span>
          {serving.engine && <span className="status-engine">{serving.engine}</span>}
        </div>
        <p className="side-note">{serving.message}</p>
        {modelsError && <p className="side-error">{modelsError}</p>}

        <div className="side-actions">
          {busy
            ? <button type="button" className="mini-btn" onClick={stopServing}>서빙 중단</button>
            : <button type="button" className="mini-btn" disabled={!selectedModelId} onClick={() => selectModel(selectedModelId)}>서빙 시작</button>}
          <button type="button" className="mini-btn" onClick={toggleLogs}>{showLogs ? '로그 숨기기' : '로그 보기'}</button>
        </div>
        {showLogs && <pre className="side-log">{servingLogs.slice(-40).join('\n') || '로그가 없습니다.'}</pre>}
      </SideSection>

      <SideSection title="시스템 프롬프트">
        <textarea
          aria-label="시스템 프롬프트"
          placeholder="예: 나는 친절한 한국어 비서다."
          value={systemPrompt}
          onChange={(event) => setSystemPrompt(event.target.value)}
        />
      </SideSection>

      {serving.status !== 'ready' || !schema.parameters.length ? (
        <SideSection title="파라미터">
          <p className="side-note">모델이 서빙되면 파라미터가 표시됩니다.</p>
        </SideSection>
      ) : schema.groups.map((group, index) => (
        <SideSection
          key={group.id}
          title={group.label}
          extra={index === 0 ? (
            <button type="button" className="head-btn" title="기본값으로 되돌리기" onClick={resetParameters}>초기화</button>
          ) : null}
        >
          {schema.parameters.filter((spec) => spec.group === group.id).map((spec) => (
            <ParameterControl key={spec.key} spec={spec} value={parameters[spec.key]} onChange={setParameter} />
          ))}
        </SideSection>
      ))}
    </div>
  );
}
