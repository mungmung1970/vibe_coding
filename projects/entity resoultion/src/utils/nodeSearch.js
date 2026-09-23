const includesAll = (text, query) => query.trim().toLowerCase().split(/\s+/).filter(Boolean).every((term) => text.includes(term));

export const hasSearch = (filters) => Boolean(filters.nodeType || filters.nameQuery?.trim() || filters.codeQuery?.trim() || filters.materialCondition || filters.materialValue?.trim());

export function searchNodes(data, filters) {
  const byId = new Map(data.nodes.map((node) => [node.node_id, node]));
  const linked = new Map();
  data.edges.forEach((edge) => {
    linked.set(edge.from, [...(linked.get(edge.from) || []), edge.to]);
    linked.set(edge.to, [...(linked.get(edge.to) || []), edge.from]);
  });
  return data.nodes.filter((node) => {
    const own = `${node.node_id} ${node.name || ''} ${JSON.stringify(node.props || {})}`.toLowerCase();
    const codes = [own, ...(linked.get(node.node_id) || []).map((id) => {
      const related = byId.get(id);
      return ['label', 'surface_form', 'identifier', 'spec_code'].includes(related?.node_type) ? `${related.name || ''} ${JSON.stringify(related.props || {})}`.toLowerCase() : '';
    })].join(' ');
    const materialText = {
      all: own,
      name: `${node.name || ''} ${node.props?.pref_name || ''}`.toLowerCase(),
      english_name: `${node.props?.english_name || ''} ${node.props?.name_en || ''}`.toLowerCase(),
      abbreviations: (node.props?.abbreviations || []).join(' ').toLowerCase(),
      alternative_names: (node.props?.alternative_names || []).join(' ').toLowerCase(),
      cas_number: String(node.props?.cas_number || '').toLowerCase(),
      ec_number: String(node.props?.ec_number || '').toLowerCase(),
      specifications: (node.props?.specifications || []).join(' ').toLowerCase(),
      description: String(node.props?.description || '').toLowerCase(),
    }[filters.materialCondition || 'all'];
    const materialMatches = !filters.materialCondition || (node.node_type === 'concept' && (!filters.materialValue?.trim() || includesAll(materialText || '', filters.materialValue)));
    return (!filters.nodeType || node.node_type === filters.nodeType)
      && (!filters.nameQuery?.trim() || includesAll(own, filters.nameQuery))
      && (!filters.codeQuery?.trim() || includesAll(codes, filters.codeQuery))
      && materialMatches;
  });
}
