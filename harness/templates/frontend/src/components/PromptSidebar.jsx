import { MODALITY_LABELS } from '../data/defaults.js';
import { useWorkbench } from '../state/WorkbenchContext.jsx';
import SideSection from './SideSection.jsx';
import ParameterControl from './ParameterControl.jsx';

export default function PromptSidebar() {
  const {
    models, providers, modalities, modalityFilter, selectedProvider, selectedModelId, selectedModel, modelsError,
    schema, parameters, systemPrompt,
    setModalityFilter, setSelectedProvider, selectModel, setParameter, resetParameters, setSystemPrompt,
  } = useWorkbench();

  const inProvider = models.filter((model) => !selectedProvider || model.provider === selectedProvider);

  return (
    <div className="sidebar-inner">
      <SideSection title="모델">
        <label className="field">
          <span className="field-label">모델 유형</span>
          <select value={modalityFilter} aria-label="모델 유형 필터" onChange={(event) => setModalityFilter(event.target.value)}>
            <option value="">전체</option>
            {modalities.map((modality) => (
              <option key={modality} value={modality}>{MODALITY_LABELS[modality] ?? modality}</option>
            ))}
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

        {selectedModel && (
          <>
            <div className={`serving-status ${selectedModel.key_ready ? 'status-ready' : 'status-error'}`}>
              <span className="status-dot" aria-hidden="true" />
              <span className="status-text">{selectedModel.key_ready ? '사용 가능' : 'API 키 필요'}</span>
              <span className="status-engine">{selectedModel.provider_type}</span>
            </div>
            <p className="side-note">{selectedModel.description}</p>
            <p className="side-note endpoint">{selectedModel.base_url}</p>
            {!selectedModel.key_ready && (
              <p className="side-error">{selectedModel.api_key_env}가 var/secrets.env에 없습니다.</p>
            )}
          </>
        )}
        {modelsError && <p className="side-error">{modelsError}</p>}
      </SideSection>

      <SideSection title="시스템 프롬프트">
        <textarea
          aria-label="시스템 프롬프트"
          placeholder="예: 나는 친절한 한국어 비서다."
          value={systemPrompt}
          onChange={(event) => setSystemPrompt(event.target.value)}
        />
      </SideSection>

      {!schema.parameters.length ? (
        <SideSection title="파라미터">
          <p className="side-note">모델을 선택하면 파라미터가 표시됩니다.</p>
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

