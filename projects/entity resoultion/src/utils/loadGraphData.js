// `src/data` is the managed source. Vite serves its published copy from `public/data`.
const RUNTIME_BASE = '/data/knowledge-graph';
const MANIFEST_URL = `${RUNTIME_BASE}/manifest.json`;

export async function loadGraphData() {
  const manifest = await fetch(MANIFEST_URL).then((response) => { if (!response.ok) throw new Error('매니페스트를 불러올 수 없습니다.'); return response.json(); });
  const read = (file) => fetch(`${RUNTIME_BASE}/${file}`).then((response) => { if (!response.ok) throw new Error(`${file}을(를) 불러올 수 없습니다.`); return response.json(); });
  const [nodeGroups, edgeGroups] = await Promise.all([Promise.all(manifest.node_files.map(read)), Promise.all(manifest.edge_files.map(read))]);
  return { nodes: nodeGroups.flat(), edges: edgeGroups.flat(), meta: { data_version: manifest.data_version, source: MANIFEST_URL } };
}
