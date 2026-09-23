import { readFile, writeFile } from 'node:fs/promises';

const files = ['물질개념_사전_G램프_L미러_v2.json', 'public/물질개념_사전_G램프_L미러_v2.json'];
for (const file of files) {
  const data = JSON.parse(await readFile(file, 'utf8'));
  for (const edge of data.edges.filter((item) => item.edge_type === 'BRIDGES_TO' && item.props?.match_type === '프록시')) {
    const rationale = edge.props.rationale || '원 물질의 직접 LCI 데이터가 없어 유사 참조물질을 사용합니다.';
    edge.props = { ...edge.props, mapping_kind: 'lci_proxy', same_substance: false, proxy_reason: rationale, conservatism_direction: /과소평가/.test(rationale) ? '과소평가 가능' : '불확실성 검토 필요', uncertainty_comment: rationale, proxy_review_required: true };
  }
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
