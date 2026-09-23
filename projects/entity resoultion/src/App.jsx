import React, { useEffect, useMemo, useState } from 'react';
import Topbar from './components/Topbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import GraphCanvas from './components/GraphCanvas.jsx';
import Inspector from './components/Inspector.jsx';
import MatchingTest from './components/MatchingTest.jsx';
import AddRelatedNodeDialog from './components/AddRelatedNodeDialog.jsx';
import { loadGraphData } from './utils/loadGraphData.js';

const DATA_URL = '/물질개념_사전_G램프_L미러_v2.json';
const fallback = { nodes: [{ node_id: 'PART:auto_lamp_G', node_type: 'part', name: 'auto_lamp_G', props: {} }, { node_id: 'CMP:glamp_housing', node_type: 'component', name: 'lamp housing', props: {} }, { node_id: 'CON:pc', node_type: 'concept', name: 'PC', props: {} }], edges: [{ edge_id: 'E1', edge_type: 'HAS_COMPONENT', cardinality: '1:n', from: 'PART:auto_lamp_G', to: 'CMP:glamp_housing' }, { edge_id: 'E2', edge_type: 'MADE_OF', cardinality: 'm:n', from: 'CMP:glamp_housing', to: 'CON:pc' }] };
const clamp = (value) => Math.max(190, Math.min(440, value));

export default function App() {
  const [data, setData] = useState(fallback); const [loaded, setLoaded] = useState(false); const [menu, setMenu] = useState(1); const [editMode, setEditMode] = useState(false); const [selected, setSelected] = useState(null); const [zoom, setZoom] = useState(1);
  const [filters, setFilters] = useState({ nodeType: '', nameQuery: '', codeQuery: '', productType: '', materialCondition: '', materialValue: '', selectedByType: {}, neighbors: true, focusNode: null });
  const [panels, setPanels] = useState({ left: 235, right: 300, leftCollapsed: false, rightCollapsed: false }); const [resizing, setResizing] = useState(null); const [addParent, setAddParent] = useState(null);
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('entity-resolution-history') || '[]'); } catch { return []; } });
  useEffect(() => { const saved = localStorage.getItem('entity-resolution-data'); if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) { setData(parsed); setLoaded(true); return; } } catch {} } loadGraphData().then(setData).catch(() => {}).finally(() => setLoaded(true)); }, []);
  useEffect(() => { if (loaded) localStorage.setItem('entity-resolution-data', JSON.stringify(data)); }, [data, loaded]);
  useEffect(() => { if (!resizing) return undefined; const move = (event) => setPanels((current) => ({ ...current, [resizing]: clamp(resizing === 'left' ? event.clientX : window.innerWidth - event.clientX) })); const stop = () => setResizing(null); window.addEventListener('mousemove', move); window.addEventListener('mouseup', stop); return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); }; }, [resizing]);
  const recordHistory = (action, item, detail) => setHistory((current) => { const targetId = item.edge_id || item.node_id; const revision = current.filter((entry) => entry.targetId === targetId).length + 1; const next = [{ id: `${Date.now()}-${Math.random()}`, targetId, action, detail, revision, at: new Date().toLocaleString('ko-KR') }, ...current].slice(0, 200); localStorage.setItem('entity-resolution-history', JSON.stringify(next)); return next; });
  useEffect(() => {
    const createPart = (event) => {
      const { form, mode, existingId } = event.detail;
      const productId = `PT:${form.productType}`;
      const productName = form.productType === 'automotive' ? '자동차 부품' : form.productType;
      const metadata = { product_type: form.productType, process: form.process.trim(), description: form.description.trim(), reference_file: form.file ? { name: form.file.name, size: form.file.size, type: form.file.type } : null };
      setData((current) => {
        if (mode === 'replace' && existingId) {
          const target = current.nodes.find((node) => node.node_id === existingId);
          const updated = { ...target, name: form.partName.trim(), props: { ...target.props, ...metadata } };
          return { ...current, nodes: current.nodes.map((node) => node.node_id === existingId ? updated : node) };
        }
        const base = form.partName.trim(); let name = base; let sequence = 2;
        while (current.nodes.some((node) => node.node_type === 'part' && node.props?.product_type === form.productType && node.name.toLowerCase() === name.toLowerCase())) name = `${base} (${sequence++})`;
        const part = { node_id: `PART:new:${Date.now()}`, node_type: 'part', name, props: metadata };
        const hasProduct = current.nodes.some((node) => node.node_id === productId);
        const product = { node_id: productId, node_type: 'product_type', name: productName, props: { product_type: form.productType, description: `${productName} 제품군입니다.` } };
        const edge = { edge_id: `E:PRODUCT_TYPE:${Date.now()}`, edge_type: 'HAS_PART', cardinality: '1:n', from: productId, to: part.node_id, props: { description: '제품유형과 파트의 소속 관계입니다.' } };
        return { ...current, nodes: [...current.nodes, ...(hasProduct ? [] : [product]), part], edges: [...current.edges, edge] };
      });
    };
    window.addEventListener('entity-create-part', createPart);
    return () => window.removeEventListener('entity-create-part', createPart);
  }, []);
  useEffect(() => {
    const editExistingPart = (event) => { setSelected(event.detail); setMenu(1); setEditMode(true); };
    window.addEventListener('entity-edit-existing-part', editExistingPart);
    return () => window.removeEventListener('entity-edit-existing-part', editExistingPart);
  }, []);
  const save = () => {};
  const addNode = () => { const name = prompt('새 항목 이름'); if (!name) return; const type = prompt('항목 유형', 'concept') || 'concept'; const node = { node_id: `NEW:${Date.now()}`, node_type: type, name, props: {} }; recordHistory('추가', node, `항목: ${name}`); setData((current) => ({ ...current, nodes: [...current.nodes, node] })); setSelected(node); };
  const addRelatedNode = ({ type, name, relation, direction }) => { const node = { node_id: `NEW:${Date.now()}`, node_type: type, name, props: { description: `${name} 신규 ${type} 항목입니다.` } }; const edge = { edge_id: `NEW:E:${Date.now()}`, edge_type: relation, cardinality: 'm:n', from: direction === 'incoming' ? node.node_id : addParent.node_id, to: direction === 'incoming' ? addParent.node_id : node.node_id, props: {} }; recordHistory('추가', node, `항목: ${name}, 관계: ${relation}`); setData((current) => ({ ...current, nodes: [...current.nodes, node], edges: [...current.edges, edge] })); setSelected(node); setAddParent(null); };
  const edit = (item) => { const value = prompt(item.edge_id ? '관계 유형' : '항목 이름', item.edge_id ? item.edge_type : item.name); if (!value) return; setData((current) => ({ ...current, nodes: current.nodes.map((node) => node.node_id === item.node_id ? { ...node, name: value } : node), edges: current.edges.map((edge) => edge.edge_id === item.edge_id ? { ...edge, edge_type: value } : edge) })); };
  const updateItem = (item, draft) => { if (item.edge_id) { if (!draft.edge_id?.trim() || !draft.edge_type?.trim() || !data.nodes.some((node) => node.node_id === draft.from) || !data.nodes.some((node) => node.node_id === draft.to)) return alert('관계명·관계 유형을 입력하고, 존재하는 시작/도착 항목 ID를 사용하세요.'); if (draft.edge_id !== item.edge_id && data.edges.some((edge) => edge.edge_id === draft.edge_id)) return alert('이미 사용 중인 관계명입니다.'); const updated = { ...item, edge_id: draft.edge_id, edge_type: draft.edge_type, from: draft.from, to: draft.to, props: { ...(item.props || {}), ...(draft.props || {}) } }; setData((current) => ({ ...current, edges: current.edges.map((edge) => edge.edge_id === item.edge_id ? updated : edge) })); setSelected(updated); recordHistory('수정', updated, `관계 유형: ${draft.edge_type}, ${draft.from} → ${draft.to}`); return; } if (!draft.name?.trim()) return alert('항목명을 입력하세요.'); setData((current) => ({ ...current, nodes: current.nodes.map((node) => node.node_id === item.node_id ? { ...node, name: draft.name } : node) })); const updated = { ...item, name: draft.name }; setSelected(updated); recordHistory('수정', updated, `항목명: ${draft.name}`); };
  const remove = (item) => { if (!item) return; const message = item.edge_id ? '선택한 관계를 삭제할까요?\n연결된 하위 항목은 삭제되지 않으며 상위 관계 없이 남습니다. 필요하면 관계 추가로 다시 연결하세요.' : '선택한 항목을 삭제할까요?\n연결된 관계도 함께 삭제됩니다.'; if (!confirm(message)) return; recordHistory('삭제', item, item.edge_id ? `관계: ${item.edge_type}` : `항목: ${item.name}`); setData((current) => item.edge_id ? ({ ...current, edges: current.edges.filter((edge) => edge.edge_id !== item.edge_id) }) : ({ ...current, nodes: current.nodes.filter((node) => node.node_id !== item.node_id), edges: current.edges.filter((edge) => edge.from !== item.node_id && edge.to !== item.node_id) })); setSelected(null); };
  const addEdge = () => { const from = prompt('출발 항목 ID'); const to = prompt('도착 항목 ID'); if (!from || !to || !data.nodes.some((node) => node.node_id === from) || !data.nodes.some((node) => node.node_id === to)) return alert('존재하는 항목 ID를 입력하세요.'); const edge = { edge_id: `NEW:${Date.now()}`, edge_type: prompt('관계 유형', 'RELATED_TO') || 'RELATED_TO', cardinality: 'm:n', from, to, props: {} }; recordHistory('추가', edge, `관계: ${edge.edge_type}, ${from} → ${to}`); setData((current) => ({ ...current, edges: [...current.edges, edge] })); setSelected(edge); };
  const context = (event, kind, item) => { event.preventDefault(); if (!editMode) return; setSelected(item); const action = prompt(`${kind === 'node' ? '항목' : '관계'} 작업: 수정 / 삭제 / 취소`, '수정'); if (action === '수정') edit(item); if (action === '삭제') remove(item); };
  const canvasMenu = (event) => { if (!editMode) return; event.preventDefault(); if (confirm('이 위치에 항목을 추가할까요?\n취소를 누르면 관계를 추가합니다.')) addNode(); else addEdge(); };
  const selectedItem = useMemo(() => selected?.edge_id ? selected : data.nodes.find((node) => node.node_id === selected?.node_id), [data, selected]);
  const selectFromSearch = (node) => { setSelected(node); setFilters((current) => ({ ...current, nodeType: '', nameQuery: '', codeQuery: '', productType: '', materialCondition: '', materialValue: '', selectedByType: {}, focusNode: node.node_id })); };
  const toggle = (side) => setPanels((current) => ({ ...current, [`${side}Collapsed`]: !current[`${side}Collapsed`] }));
  const changeMenu = (next) => { setMenu(next); setEditMode(next === 0 ? 'new' : false); };
  const title = menu === 0 ? '신규 생성' : menu === 1 ? '조회 및 수정' : '매칭결과 테스트';
  return <div className="app"><Topbar menu={menu} setMenu={changeMenu} /><div className={`workspace ${panels.leftCollapsed ? 'left-collapsed' : ''} ${panels.rightCollapsed ? 'right-collapsed' : ''}`} style={{ '--left-width': `${panels.left}px`, '--right-width': `${panels.right}px` }}>{!panels.leftCollapsed && <Sidebar data={data} filters={filters} setFilters={setFilters} editMode={editMode} onSelectNode={selectFromSearch} />}<div className="resize-handle left-handle" onMouseDown={() => !panels.leftCollapsed && setResizing('left')}><button onMouseDown={(event) => event.stopPropagation()} onClick={() => toggle('left')}>{panels.leftCollapsed ? '›' : '‹'}</button></div><main className="main"><div className="page-heading"><div><span className="eyebrow">지식 그래프</span><h1>{title}</h1><p>{menu === 2 ? '검색어 기반으로 물질개념 매칭 후보를 확인합니다.' : '항목과 관계를 생성·조회하고 편집합니다.'}</p></div><div className="heading-stats"><span><b>{data.nodes.length.toLocaleString()}</b> 항목</span><span><b>{data.edges.length.toLocaleString()}</b> 관계</span></div></div>{menu === 2 ? <MatchingTest data={data} onSelect={(node) => { selectFromSearch(node); setMenu(1); }} /> : <GraphCanvas data={data} filters={filters} selected={selectedItem} setSelected={setSelected} editMode={editMode} onContextMenu={context} onCanvasMenu={canvasMenu} zoom={zoom} setZoom={setZoom} />}</main><div className="resize-handle right-handle" onMouseDown={() => !panels.rightCollapsed && setResizing('right')}><button onMouseDown={(event) => event.stopPropagation()} onClick={() => toggle('right')}>{panels.rightCollapsed ? '‹' : '›'}</button></div>{!panels.rightCollapsed && <Inspector item={selectedItem} data={data} editMode={editMode} onDelete={remove} onUpdate={updateItem} onSelect={setSelected} onToggleEdit={() => setEditMode((current) => !current)} onSave={save} onCollapse={() => toggle('right')} onAddRelated={setAddParent} />}</div>{addParent && <AddRelatedNodeDialog parent={addParent} onClose={() => setAddParent(null)} onCreate={addRelatedNode} />}</div>;
}
