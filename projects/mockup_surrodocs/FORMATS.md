# XML 매핑 정보는 어디에 있나

**단일 출처: [`formats.js`](formats.js)** — 화면 항목 → XML 태그 경로 → 적용 서식이 표 데이터로 들어 있다.
화면의 *"이 템플릿의 XML 구조 · 서식 매핑 보기"* 버튼도 같은 표를 렌더링하므로 문서와 화면이 갈라지지 않는다.

```
formats.js
 ├ DOC_TEMPLATES / PPT_TEMPLATES   템플릿별 색·글꼴·머리말
 ├ UNITS                            포맷별 단위 (twip / EMU / HWPUNIT)
 ├ PACKAGE_PARTS                    포맷별 ZIP 파트 목록
 ├ FIELD_MAP[문서종류][포맷].rows   [화면 항목, XML 경로, 적용 서식]
 └ renderMapping() / downloadXmlParts()
```

`FIELD_MAP` 의 `{accent}` `{head}` `{bg}` `{side}` `{ink}` `{sub}` 는 선택된 템플릿 값으로 치환된다.

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| `index.html` / `styles.css` | 화면 |
| `app.js` | 공통 유틸(`$`, `esc`, `xe`, `download`), ZIP 라이터, 장애보고서 DOCX 빌더 |
| `formats.js` | **매핑·템플릿 정의**, 매핑 뷰 렌더링, 생성 XML 덤프 |
| `llm.js` | gpt-oss-120b (OpenAI 호환) 질의 — `llmChat` / `llmJSON` / `runLLM` |
| `hwpx.js` | 한글 HWPX(OWPML) 빌더 — 문단·표·셀병합·중첩표·패키지 |
| `trend.js` | 최신 기술동향 PPTX |
| `complex.js` | 복합 구조 문서(3단 목차·병합·중첩표) HWPX |
| `main.js` | 문서 유형 탭, 매핑 모달 |
| `selfcheck.js` | `node selfcheck.js` — 3종 생성 + 구조 검증 |
| `pipeline/` | 스캔 PDF 양식 → 엑셀 → DOCX/HWPX 재생성 (`pipeline/README.md`) |

## 문서 3종

| 문서 | 포맷 | 내용 출처 |
| --- | --- | --- |
| 장애보고서 | DOCX 또는 HWPX 선택 | 직접 입력 |
| 최신 기술동향 | PPTX (16:9) | LLM |
| 복합 구조 문서 | HWPX | LLM |

## 포맷별 핵심 차이

| | DOCX | PPTX | HWPX |
| --- | --- | --- | --- |
| 본문 파트 | `word/document.xml` | `ppt/slides/slideN.xml` | `Contents/section0.xml` |
| 서식 정의 | `word/styles.xml` | 각 도형에 인라인 | `Contents/header.xml` refList (ID 참조) |
| 글자 크기 | `w:sz` half-point | `sz` 1/100pt | `height` 1/100pt |
| 길이 | twip (1440/in) | EMU (914400/in) | HWPUNIT (7200/in) |
| 셀 병합 | `w:gridSpan` (가로만 구현) | — | `hp:cellSpan @colSpan/@rowSpan` |
| 표 안의 표 | 미구현 | — | `hp:tc > hp:subList > hp:p > hp:run > hp:tbl` |

HWPX 는 서식을 값이 아니라 **ID 참조**로 쓴다. `section0.xml` 이 쓰는 `charPrIDRef` / `paraPrIDRef` /
`borderFillIDRef` 는 반드시 `header.xml` 의 refList 에 있어야 하며, `selfcheck.js` 가 이를 검사한다.
`mimetype` 은 ZIP 의 첫 엔트리이고 무압축이어야 한다.

## 검증 상태

`node selfcheck.js` 로 파트 구성, XML 선언, HWPX ID 참조 무결성, `cellAddr` 병합 좌표,
중첩표 위치, 목차 3단계, 슬라이드 수를 확인한다. **한글·워드·파워포인트 실제 열기 검증은 아직 못 했다.**
