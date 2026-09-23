import { readFile, writeFile } from 'node:fs/promises';

const files = ['물질개념_사전_G램프_L미러_v2.json', 'public/물질개념_사전_G램프_L미러_v2.json'];
const productTypeNames = { automotive: '자동차 부품' };
const refDbSource = JSON.parse(await readFile('src/data/ref_db_name.json', 'utf8'));
const lciRows = Object.values(refDbSource)[0] || [];
const unique = (items) => [...new Set(items.filter(Boolean))];
const genericLciWords = new Set(['for', 'of', 'the', 'and', 'with', 'from', 'to', 'in', 'at', 'on', 'granulate', 'product', 'production', 'market', 'bulk', 'grade', 'liquid', 'primary', 'cast', 'alloy', 'polymerised', 'amorphous', 'uncoated']);
const lciWords = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter((word) => word.length > 1 && !genericLciWords.has(word));
function findLciCandidate(referenceName) {
  const words = lciWords(referenceName);
  const scored = lciRows.filter((row) => !/^treatment of\b/i.test(row.ref_name)).map((row) => {
    const text = String(row.ref_name || '').toLowerCase();
    const hits = words.filter((word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text));
    if (hits.length < (words.length > 1 ? Math.ceil(words.length * 0.6) : 1)) return null;
    const priority = /^market for\b/i.test(text) ? 1 : /\bproduction\b/i.test(text) ? 2 : 0;
    const directProduction = words.some((word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|[-,])[^,]{0,24}\\bproduction\\b`, 'i').test(text));
    const startsWithMaterial = words.some((word) => new RegExp(`^(?:primary )?${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
    return { row, priority, score: hits.length * 10 + (hits.length === words.length ? 20 : 0) + (text.includes(String(referenceName).toLowerCase()) ? 20 : 0) + (directProduction ? 30 : 0) + (startsWithMaterial ? 40 : 0) };
  }).filter(Boolean);
  const bestOf = (priority) => scored.filter((candidate) => candidate.priority === priority).sort((a, b) => b.score - a.score || Number(a.row.ref_id) - Number(b.row.ref_id))[0];
  return bestOf(2) || bestOf(1) || null;
}
const domainDescriptions = {
  plastics: '고분자 수지와 복합재를 관리하는 재질 도메인입니다. 자동차 외장·조명·전장 부품의 사출, 압출, 도장 대상 수지를 포함합니다.',
  metals: '철강·알루미늄·구리 등 금속 및 합금을 관리하는 재질 도메인입니다. 구조부, 방열부, 체결부의 소재와 규격을 포함합니다.',
  glass: '평판유리·광학유리 등 유리 재질을 관리하는 도메인입니다. 미러글라스와 조명용 광학 부품의 기재를 포함합니다.',
  chemicals: '접착제·도료·실링재 등 화학 제품과 공정 보조 재료를 관리하는 도메인입니다.',
  electronics: 'PCB, LED, 커넥터, 자석 등 전장 및 전자 부품의 재질과 구성 정보를 관리하는 도메인입니다.',
};
const partDescriptions = {
  'PART:auto_lamp_G': '자동차용 LED 헤드램프 어셈블리입니다. 렌즈, 하우징, 리플렉터, 방열판, LED 및 전장 연결부로 구성되며, 광학 성능·방열·내후성을 함께 관리합니다.',
  'PART:mirror_L': '차량 좌측 아웃사이드 미러 어셈블리입니다. 미러글라스, 커버, 구동 모터, 열선 필름, 하네스 및 체결부로 구성되며 시야 확보와 전동 조절 기능을 담당합니다.',
};
const componentDescriptions = {
  '렌즈': '광원을 투과·굴절시켜 배광을 형성하는 광학 부품입니다. 투명성, 내충격성, 내후성이 주요 관리 특성입니다.',
  '하우징': '램프 내부 부품을 지지하고 외부 환경으로부터 보호하는 구조 부품입니다. 강성, 치수 안정성 및 내열성이 중요합니다.',
  '리플렉터': '광원을 반사해 목표 방향으로 유도하는 광학 구조 부품입니다. 반사막과 기재의 표면 품질을 함께 관리합니다.',
  '히트싱크': 'LED 등 발열 부품의 열을 외부로 방출하는 방열 부품입니다. 열전도율과 형상 안정성이 핵심 특성입니다.',
  '베젤': '조명 모듈의 외관과 조립 경계를 형성하는 장식·구조 부품입니다.',
  'PCB': '전자 회로와 전자부품을 기계적·전기적으로 연결하는 인쇄회로기판입니다.',
  'LED 패키지': '전기에너지를 빛으로 변환하는 광원 모듈입니다. 광효율, 색좌표, 열 관리가 중요합니다.',
  '커넥터': '전원과 신호를 탈부착 가능하게 연결하는 전장 인터페이스 부품입니다.',
  '실링': '수분과 먼지의 유입을 막아 램프 내부를 밀폐하는 재료 또는 구조입니다.',
  '마운팅 브라켓': '어셈블리를 차량 차체에 위치·고정하는 지지 구조 부품입니다.',
  '체결 볼트': '부품 또는 어셈블리를 체결하는 표준 체결 부품입니다. 강도, 표면처리 및 부식 저항을 관리합니다.',
  '미러글라스': '후방 시야를 제공하는 반사 유리 부품입니다. 반사막, 곡률 및 열선 적용 여부를 관리합니다.',
  '미러 커버': '미러 어셈블리 외관을 형성하고 내부 구조를 보호하는 외장 부품입니다.',
  '미러 브라켓': '미러글라스와 구동부를 지지·결합하는 구조 부품입니다.',
  '구동 모터': '미러 각도를 전동으로 조절하는 구동 부품입니다.',
  '기어': '모터의 회전력을 미러 조절기구에 전달하는 동력 전달 부품입니다.',
  '와이어하니스': '전원·신호선을 묶어 전장 부품 사이를 연결하는 배선 어셈블리입니다.',
  '열선 필름': '미러 표면의 결로·성에를 제거하기 위해 발열하는 필름형 부품입니다.',
};

function defaultDescription(node) {
  if (node.node_type === 'product_type') return `${node.name} 제품유형입니다. 해당 제품유형에 속한 파트와 그 하위 구성물·물질개념을 탐색하는 최상위 분류 항목입니다.`;
  if (node.node_type === 'domain') return domainDescriptions[node.name] || `${node.name} 재질 분류 도메인입니다.`;
  if (node.node_type === 'part') return partDescriptions[node.node_id] || `${node.name} 제품 어셈블리입니다.`;
  if (node.node_type === 'component') return componentDescriptions[node.name] || `${node.name} 구성 부품입니다.`;
  if (node.node_type === 'process') return `${node.name} 제조 공정입니다. 연결된 부품·소재의 생산 방법을 식별하는 데 사용합니다.`;
  if (node.node_type === 'label') return `${node.props?.label_type || '명칭'} 라벨입니다. 물질명 검색과 엔터티 매칭의 후보 표현으로 사용합니다.`;
  if (node.node_type === 'surface_form') return `입력 표기 변형입니다. 원문·OCR·공백·하이픈·대소문자 차이를 흡수해 물질개념 후보를 찾는 데 사용합니다.`;
  if (node.node_type === 'identifier') return `${node.props?.id_type || '식별자'} 값으로, 물질개념을 외부 체계와 정확하게 연결하는 데 사용합니다.`;
  if (node.node_type === 'qualifier') return `${node.props?.qual_type || '한정자'} 정보입니다. 기본 물질개념의 등급·형태·조성 등 세부 조건을 구분합니다.`;
  if (node.node_type === 'spec_code') return `${node.props?.system || '규격'} 체계의 코드입니다. 물질 및 제품 사양을 표준 기준으로 식별합니다.`;
  if (node.node_type === 'reference_material') return `${node.name}은(는) 외부 LCI 또는 참조 데이터셋에서 사용하는 기준 재질 항목입니다. 실제 물질개념과 연결해 환경영향 데이터 매칭 후보로 사용합니다.`;
  if (node.node_type === 'vendor_item') return `${node.name}은(는) 공급사·제품 단위로 관리하는 재질 또는 부품 항목입니다. 상위 물질개념, 규격 및 적용 부품을 연결해 구매·사양 데이터를 추적합니다.`;
  if (node.node_type === 'description') return `${node.name}에 대한 원문 설명 항목입니다. 물질의 특성·용도·관리 근거를 기록하고 물질개념의 상세 설명으로 사용합니다.`;
  return `${node.name || node.node_id} 관련 지식 그래프 항목입니다.`;
}

function namesFor(links, edgeTypes, limit = 4) {
  return unique(links.filter(({ edge, other }) => edgeTypes.includes(edge.edge_type) && other).map(({ other }) => other.name)).slice(0, limit);
}

function detailedDescription(node, links) {
  const base = defaultDescription(node);
  const relatedConcepts = namesFor(links, ['MADE_OF', 'HAS_LABEL', 'HAS_IDENTIFIER', 'HAS_QUALIFIER', 'HAS_SPEC_CODE', 'HAS_DESCRIPTION', 'ALIAS_OF_ITEM', 'NOT_CONFUSE_WITH']);
  const components = namesFor(links, ['HAS_COMPONENT', 'MADE_OF']);
  const parts = namesFor(links, ['HAS_PART', 'HAS_COMPONENT']);
  const processes = namesFor(links, ['HAS_PROCESS']);

  if (node.node_type === 'concept') {
    const labels = namesFor(links, ['HAS_LABEL']);
    const identifiers = namesFor(links, ['HAS_IDENTIFIER']);
    const appliedTo = namesFor(links, ['MADE_OF']);
    return node.props?.description || `${node.name} 물질개념입니다.${labels.length ? ` 검색·매칭에 사용하는 명칭은 ${labels.join(', ')}입니다.` : ''}${identifiers.length ? ` 식별 정보는 ${identifiers.join(', ')}입니다.` : ''}${appliedTo.length ? ` 연결된 적용 대상은 ${appliedTo.join(', ')}입니다.` : ''} 물질명, 약어, 대체어 및 한정자를 함께 관리하여 LCI 물질명 매칭의 정확도를 높입니다.`;
  }
  if (node.node_type === 'process') return `${base}${relatedConcepts.length ? ` 관련 재질은 ${relatedConcepts.join(', ')}입니다.` : ''}${components.length ? ` 적용 부품은 ${components.join(', ')}입니다.` : ''}`;
  if (node.node_type === 'part') return `${base}${components.length ? ` 주요 구성품은 ${components.join(', ')}입니다.` : ''}${processes.length ? ` 연결된 제조 공정은 ${processes.join(', ')}입니다.` : ''}`;
  if (node.node_type === 'component') return `${base}${relatedConcepts.length ? ` 연결된 재질·식별 정보는 ${relatedConcepts.join(', ')}입니다.` : ''}${parts.length ? ` 소속 제품 또는 모듈은 ${parts.join(', ')}입니다.` : ''}`;
  if (['label', 'surface_form', 'identifier', 'qualifier', 'spec_code', 'reference_material', 'vendor_item'].includes(node.node_type)) return `${base}${relatedConcepts.length ? ` 연결 대상은 ${relatedConcepts.join(', ')}입니다.` : ''}`;
  return base;
}

function enrich(data) {
  data.nodes.filter((node) => node.node_type === 'part' && node.props?.product_type).forEach((part) => {
    const productType = part.props.product_type;
    const productTypeId = `PT:${productType}`;
    if (!data.nodes.some((node) => node.node_id === productTypeId)) data.nodes.push({ node_id: productTypeId, node_type: 'product_type', name: productTypeNames[productType] || productType, props: { product_type: productType } });
    if (!data.edges.some((edge) => edge.from === productTypeId && edge.to === part.node_id && edge.edge_type === 'HAS_PART')) data.edges.push({ edge_id: `E:PRODUCT_TYPE:${productType}:${part.node_id}`, edge_type: 'HAS_PART', cardinality: '1:n', from: productTypeId, to: part.node_id, props: {} });
  });
  const byId = new Map(data.nodes.map((node) => [node.node_id, node]));
  data.nodes.filter((node) => node.node_type === 'reference_material').forEach((node) => {
    const selected = findLciCandidate(node.name);
    node.props = { ...node.props, lci_db_name: selected?.row.lci_db || null, ref_id: selected?.row.ref_id ? String(selected.row.ref_id) : null, lci_ref_name: selected?.row.ref_name || null, lci_mapping_priority: selected?.priority === 2 ? 'production 우선' : selected?.priority === 1 ? 'market for 차선' : '매핑 후보 없음' };
  });
  data.edges.filter((edge) => edge.edge_type === 'BRIDGES_TO').forEach((edge) => {
    const reference = byId.get(edge.to);
    edge.props = { ...edge.props, lci_db_name: reference?.props?.lci_db_name || null, ref_id: reference?.props?.ref_id || null, lci_ref_name: reference?.props?.lci_ref_name || null, lci_mapping_priority: reference?.props?.lci_mapping_priority || '매핑 후보 없음' };
  });
  const related = new Map();
  data.edges.forEach((edge) => {
    if (!related.has(edge.from)) related.set(edge.from, []);
    if (!related.has(edge.to)) related.set(edge.to, []);
    related.get(edge.from).push({ edge, other: byId.get(edge.to), outbound: true });
    related.get(edge.to).push({ edge, other: byId.get(edge.from), outbound: false });
  });

  data.nodes.filter((node) => node.node_type === 'concept').forEach((concept) => {
    const links = related.get(concept.node_id) || [];
    const labels = links.filter(({ edge, other }) => edge.edge_type === 'HAS_LABEL' && other);
    const values = (type) => labels.filter(({ other }) => other.props?.label_type === type).map(({ other }) => other.name);
    const linked = (type) => links.filter(({ edge, other }) => edge.edge_type === type && other).map(({ other }) => other.name);
    const identifierValues = (idType) => links.filter(({ edge, other }) => edge.edge_type === 'HAS_IDENTIFIER' && other?.props?.id_type === idType).map(({ other }) => other.props.value || other.name);
    const descriptions = linked('HAS_DESCRIPTION');
    const lciBridgeMappings = links.filter(({ edge, outbound, other }) => outbound && edge.edge_type === 'BRIDGES_TO' && other).map(({ edge, other }) => ({ reference_material: other.name, lci_db_name: edge.props?.lci_db_name || other.props?.lci_db_name || null, ref_id: edge.props?.ref_id || other.props?.ref_id || null, lci_ref_name: edge.props?.lci_ref_name || other.props?.lci_ref_name || null, lci_mapping_priority: edge.props?.lci_mapping_priority || other.props?.lci_mapping_priority || '매핑 후보 없음', match_type: edge.props?.match_type || null, confidence: edge.props?.confidence ?? null }));
    const primaryLciBridge = lciBridgeMappings.find((mapping, index) => links.filter(({ edge, outbound }) => outbound && edge.edge_type === 'BRIDGES_TO')[index]?.edge.props?.is_selected) || lciBridgeMappings[0] || {};
    const { abbr, ...conceptProps } = concept.props;
    concept.props = {
      ...conceptProps,
      english_name: concept.props.name_en || values('정식명').find((name) => /^[A-Za-z]/.test(name)) || null,
      abbreviations: unique([abbr, ...values('약어')]),
      alternative_names: unique([...values('유사어'), ...values('대체어'), ...values('관용어')]),
      trade_names: unique([...values('상품명'), ...linked('ALIAS_OF_ITEM')]),
      translations: unique(values('번역')),
      identifiers: unique(linked('HAS_IDENTIFIER')),
      cas_number: identifierValues('CAS')[0] || null,
      ec_number: identifierValues('EC')[0] || null,
      un_number: identifierValues('UN')[0] || null,
      chemical_formula: concept.props.chemical_formula || null,
      inchi_key: concept.props.inchi_key || null,
      internal_material_code: concept.props.internal_material_code || null,
      lci_db_name: primaryLciBridge.lci_db_name || null,
      lci_ref_id: primaryLciBridge.ref_id || null,
      lci_reference_material_name: primaryLciBridge.reference_material || null,
      lci_bridge_mappings: lciBridgeMappings,
      qualifiers: unique(linked('HAS_QUALIFIER')),
      specifications: unique(linked('HAS_SPEC_CODE')),
      description: descriptions[0] || detailedDescription(concept, links),
      broader_terms: unique(links.filter(({ edge, outbound, other }) => edge.edge_type === 'BROADER_THAN' && !outbound && other).map(({ other }) => other.name)),
      narrower_terms: unique(links.filter(({ edge, outbound, other }) => edge.edge_type === 'BROADER_THAN' && outbound && other).map(({ other }) => other.name)),
      confusing_with: unique(linked('NOT_CONFUSE_WITH')),
      detail_schema: 'material-detail-v1',
    };
  });
  data.nodes.filter((node) => node.node_type !== 'concept').forEach((node) => {
    node.props = { ...node.props, description: detailedDescription(node, related.get(node.node_id) || []), detail_schema: 'entity-detail-v1' };
    if (node.node_type === 'part') node.props.product_type_description = '자동차 산업용 완성 부품 또는 모듈 분류입니다. 차량 기능과 조립 단위 기준으로 구성품·재질·공정을 연결합니다.';
  });
  return data;
}

for (const file of files) {
  const data = enrich(JSON.parse(await readFile(file, 'utf8')));
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
