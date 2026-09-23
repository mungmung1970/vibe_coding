/* ============================================================
 * main.js — 문서 유형 전환 + XML 구조/서식 매핑 뷰어
 * ============================================================ */

const VIEWS = { incident: 'viewIncident', trend: 'viewTrend', complex: 'viewComplex' };

$('docTypeTabs').addEventListener('click', e => {
  const b = e.target.closest('.doctype'); if (!b) return;
  document.querySelectorAll('.doctype').forEach(x => x.classList.toggle('selected', x === b));
  Object.entries(VIEWS).forEach(([k, id]) => { $(id).hidden = k !== b.dataset.doc; });
});

/* XML 구조 보기 — formats.js 의 FIELD_MAP 을 선택된 템플릿 값으로 채워 보여준다 */
function showMapping(kind, fmt, tpl) {
  $('mapBody').innerHTML = renderMapping(kind, fmt, tpl);
  $('mapTitle').textContent = `XML 구조 · 서식 매핑 — ${fmt.toUpperCase()} / ${tpl.name}`;
  $('mapModal').hidden = false;
}
$('mapClose').onclick = () => { $('mapModal').hidden = true; };
$('mapModal').addEventListener('click', e => { if (e.target.id === 'mapModal') $('mapModal').hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('mapModal').hidden = true; });
