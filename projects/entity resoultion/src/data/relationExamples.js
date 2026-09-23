export const RELATION_GROUPS = [
  { title: '라벨유형 (N08)', relation: 'HAS_LABEL', items: [
    ['약어', 'PP = 폴리프로필렌', 'PP'],
    ['상위어 · 하위어', '열가소성수지 ↔ 폴리아미드 ↔ PA66', 'PA66'],
    ['관용어', '가성소다 = 수산화나트륨', '수산화나트륨'],
    ['대체어', '같은 물질의 다른 이름 · 정체성은 동일', 'alias'],
    ['상품명', 'Teflon = PTFE (등록상표)', 'PTFE'],
    ['번역', 'Acetone / 아세톤 / アセトン', 'Acetone'],
  ] },
  { title: '표기변형 유형 (N09)', relation: 'HAS_SURFACE_FORM', items: [
    ['대소문자 · 공백 · 하이픈', 'sodium chloride / Sodium-Chloride', 'sodium chloride'],
    ['구조 접두어', 'n- · iso- · tert- · o/m/p- · α → alpha', 'alpha'],
    ['첨자 · 특수문자', 'H₂SO₄ / H2SO4', 'H2SO4'],
    ['오타 · OCR 오류', '폴리프로파일렌, ALDC12,1 — 편집거리 후보용', 'ALDC12'],
  ] },
  { title: '한정자 유형 (N10)', relation: 'HAS_QUALIFIER', items: [
    ['농도 · 순도', 'NaOH 50% 용액 vs 고체', 'NaOH'],
    ['등급', 'industrial / technical / electronic grade', 'grade'],
    ['염 · 수화물', '무수물 vs 5수염, 나트륨염 vs 유리산', 'hydrate'],
    ['물리형태', '분말 · 펠릿 · 용액 · 기체', 'pellet'],
    ['이성질체 · 중합도', 'LDPE / HDPE, PA6 / PA66', 'PA66'],
  ] },
  { title: '규격체계 (N13)', relation: 'HAS_SPEC_CODE', items: [
    ['KS · JIS · ASTM · EN', 'ALDC12.1 = ADC12 = A383 = AC-46000', 'ALDC12'],
    ['ISO 1043 · IMDS', '플라스틱 약호 · 자동차 재질분류', 'ISO 1043'],
  ] },
  { title: '혼동쌍 사유 (N16)', relation: 'NOT_CONFUSE_WITH', items: [
    ['약어 충돌', 'PE ↔ PET', 'PE'],
    ['이름 유사', '소다회(Na₂CO₃) ↔ 가성소다(NaOH)', 'NaOH'],
  ] },
  { title: '매칭유형 (N17)', relation: 'MATCH_TYPE', items: [
    ['정확', '식별자 또는 규격코드가 일치', 'exact'],
    ['유사', '개념은 일치하나 한정자 일부가 불일치', 'similar'],
    ['프록시', '해당 물질 데이터셋이 없어 유사 물질로 대체 · 선정 근거·보수성 방향·불확실성 코멘트 필수', 'proxy'],
  ] },
];
