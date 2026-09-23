/* ============================================================
 * pipeline/fieldmap.js — "위험성평가 실시규정" 양식의 항목 ↔ XML 태그 ↔ 서식 매핑
 *
 * formats.js 의 FIELD_MAP 과 같은 모양이다. 다른 점은 출처가 화면 입력이 아니라
 * 엑셀 시트라는 것 — 그래서 [엑셀 시트, 항목, DOCX 경로, HWPX 경로, 적용 서식] 5열이다.
 * 3단계 빌더(form.js)와 엑셀의 'XML매핑' 시트가 모두 이 표 하나를 본다.
 * ============================================================ */
const FORM_MAP = {
  name: '위험성평가 실시규정',
  rows: [
    ['문서정보', '머리표지 (참 고)',
      'w:body > w:tbl[머리] > w:tr > w:tc/w:tcPr/w:shd@w:fill="{accent}" > w:p/w:r/w:t',
      'hp:tbl > hp:tc[borderFillIDRef=3] > hp:subList > hp:p/hp:run/hp:t',
      'DOCX: 흰 글자 w:b · HWPX: charPr 5(thead) + borderFill 3(faceColor #{accent})'],
    ['문서정보', '문서 제목',
      'w:body > w:tbl[머리] > w:tc[2] > w:p/w:r/w:rPr/w:b + w:sz 28',
      'hp:tbl > hp:tc[2] > hp:subList > hp:p[paraPrIDRef=1]/hp:run[charPrIDRef=1]/hp:t',
      'DOCX: 14pt bold {accent} · HWPX: charPr 1 height 2000'],
    ['문서정보', '결재란 (담당자·검토자·근로자대표·승인자)',
      'w:tbl > w:tr > w:tc[3..6] > w:tcPr/w:shd@w:fill="{soft}" > w:p/w:r/w:t',
      'hp:tbl > hp:tc[borderFillIDRef=4] > hp:cellSpan@rowSpan="2" (서명칸 세로 병합)',
      '머리행 {soft} 배경 · 서명칸은 빈 셀 2행 병합'],
    ['문서정보', '업체명(현장명) / 작성일자(개정일자)',
      'w:tbl > w:tr > w:tc[1]{라벨} + w:tc[2]{값, w:gridSpan 2}',
      'hp:tbl > hp:tr > hp:tc[label] + hp:tc/hp:cellSpan@colSpan="2"',
      '라벨 셀 {soft} 배경 가운데 정렬 · 값 셀 가로 병합'],
    ['문서정보', '목적 / 방법',
      'w:tbl > w:tr > w:tc[라벨]{w:shd {soft}} + w:tc[본문]',
      'hp:tbl > hp:tr > hp:tc[soft] + hp:tc > hp:subList > hp:p[paraPrIDRef=9]',
      '한 행에 2쌍(라벨·본문) · 본문은 왼쪽 정렬 셀 문단(paraPr 9)'],
    ['조직도', '조직 및 역할 — 조직도 상자',
      'w:tbl[조직도] > w:tr > w:tc > w:p[가운데]/w:r/w:t',
      'hp:tbl > hp:tc[borderFillIDRef=4] > hp:subList > hp:p[paraPrIDRef=8]/hp:run/hp:t',
      '상자 = 1행 1열 표 · 계층은 들여쓰기로 표현'],
    ['조직_역할', '역할별 책임사항',
      'w:tbl > w:tr > w:tc[역할]{w:vMerge} + w:tc[책임사항]',
      'hp:tbl > hp:tc/hp:cellSpan@rowSpan="n" (역할 세로 병합)',
      '역할 셀은 책임사항 수만큼 세로 병합 · 책임사항은 글머리표 유지'],
    ['평가절차', '평가 절차 및 방법 ①~⑥',
      'w:tbl > w:tr > w:tc[단계]{w:shd {accent}, 흰 글자} + w:tc[세부내용]',
      'hp:tbl > hp:tc[borderFillIDRef=3] + hp:tc > hp:subList > hp:p 여러 개',
      '단계 셀 {accent} 배경 · 세부내용은 줄마다 문단 1개'],
    ['위험성수준', '위험성 수준 3단계 판단 기준',
      'w:tbl > w:tr > w:tc + 세로 병합 w:vMerge (허용 가능 여부)',
      'hp:tbl > hp:tc/hp:cellSpan@rowSpan="2" (허용 불가능)',
      '머리행 {head} · 빈 칸이 이어지면 위 칸과 세로 병합'],
    ['상시평가', '상시평가 시기별 활동',
      'w:tbl > w:tr > w:tc[주기]{w:vMerge} + w:tc[참여자]{w:vMerge} + w:tc[세부내용]',
      'hp:tbl > hp:tc/hp:cellSpan@rowSpan + hp:tc > hp:subList > hp:p[머리줄 charPrIDRef=5]',
      '주기·참여자 셀 세로 병합 · 세부내용 첫 줄은 {accent} 머리줄'],
    ['기록_비고', '기록 보존 / 안내문',
      'w:tbl > w:tr > w:tc[라벨] + w:tc[내용] · 안내문은 w:p[Normal]',
      'hp:tbl > hp:tc + hp:tc · 안내문은 hp:p[paraPrIDRef=0]/hp:run[charPrIDRef=6]',
      '안내문은 9pt 회색(charPr 6 / DOCX w:sz 18 color 777777)'],
    ['(공통)', '용지 · 여백',
      'w:body > w:sectPr > w:pgSz w:w=11906 w:h=16838 / w:pgMar',
      'hp:p > hp:run > hp:secPr > hp:pagePr width=59528 height=84188 / hp:margin',
      'A4 세로 · DOCX twip(1440/in) · HWPX HWPUNIT(7200/in)']
  ]
};
module.exports = { FORM_MAP };
