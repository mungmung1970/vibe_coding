import React, { useMemo, useState } from 'react';

const rules = {
  part: [{ type: 'component', relation: 'HAS_COMPONENT', label: '구성 부품' }],
  component: [{ type: 'concept', relation: 'MADE_OF', label: '구성 재질' }],
  concept: [
    { type: 'label', relation: 'HAS_LABEL', label: '라벨·약어·대체어' }, { type: 'identifier', relation: 'HAS_IDENTIFIER', label: '식별자' }, { type: 'qualifier', relation: 'HAS_QUALIFIER', label: '한정자' }, { type: 'spec_code', relation: 'HAS_SPEC_CODE', label: '규격 코드' }, { type: 'description', relation: 'HAS_DESCRIPTION', label: '설명' }, { type: 'process', relation: 'USED_IN_PROCESS', label: '적용 공정' }, { type: 'reference_material', relation: 'BRIDGES_TO', label: '참조 재질' }, { type: 'domain', relation: 'IN_DOMAIN', label: '도메인' }, { type: 'concept', relation: 'BROADER_THAN', label: '하위 물질개념' },
  ],
  label: [{ type: 'surface_form', relation: 'HAS_SURFACE_FORM', label: '표기변형' }],
  domain: [{ type: 'concept', relation: 'IN_DOMAIN', label: '물질개념', direction: 'incoming' }],
  process: [{ type: 'concept', relation: 'USED_IN_PROCESS', label: '물질개념', direction: 'incoming' }],
  reference_material: [{ type: 'concept', relation: 'BRIDGES_TO', label: '물질개념', direction: 'incoming' }],
};

export default function AddRelatedNodeDialog({ parent, onClose, onCreate }) {
  const options = rules[parent.node_type] || [];
  const [index, setIndex] = useState(0); const [name, setName] = useState('');
  const selected = useMemo(() => options[index] || null, [options, index]);
  const submit = (event) => { event.preventDefault(); if (!selected || !name.trim()) return; onCreate({ ...selected, name: name.trim() }); };
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}><form className="node-dialog" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}><header><div><span className="eyebrow">ADD RELATED ITEM</span><h2>연결 항목 추가</h2><p><b>{parent.name}</b> ({parent.node_type})에 허용된 관계만 추가할 수 있습니다.</p></div><button type="button" className="dialog-close" onClick={onClose}>×</button></header>{options.length ? <><label>추가할 관련 항목<select value={index} onChange={(event) => setIndex(Number(event.target.value))}>{options.map((option, optionIndex) => <option value={optionIndex} key={`${option.type}-${option.relation}`}>{option.label} · {option.type}</option>)}</select></label><label>관계 유형<input value={selected.relation} readOnly /></label><label>항목명<input value={name} onChange={(event) => setName(event.target.value)} placeholder={`새 ${selected.label} 이름`} autoFocus /></label></> : <p className="dialog-note">이 유형에는 새 연결 항목 생성 규칙이 정의되어 있지 않습니다.</p>}<footer><button type="button" onClick={onClose}>취소</button>{options.length > 0 && <button className="primary" type="submit">항목 및 관계 추가</button>}</footer></form></div>;
}
