# bom_test · BOM 기본정보 추출 콘솔

한글(hwp/hwpx)·워드(docx)·파워포인트(pptx)·엑셀(xlsx) 파일을 올리면 **gpt-oss-120b** 하나만 호출해
표준물질 기본정보를 뽑는다. `projects/model_test_pc`의 무의존 백엔드 골격(`core/http.py`,
`services/documents.py`, `services/secrets.py`)을 그대로 가져와 썼다.

## 기본정보 여섯 항목

`표준물질명`, `데이터유형`(제품·자재·물질), `CAS번호`, `지역`, `년도`, `공정`.

문서에 근거가 있는 값만 이 여섯 칸에 들어간다. 규격에 맞지 않거나(데이터유형이 세 값 밖,
CAS가 `n-nn-n` 형식 아님, 년도가 네 자리 아님) 추측한 값은 **부가정보**로 옮기고 항목명에
`추정 `을 붙인다. 여섯 항목에 없는 정보(규격·수량·공급사 등)도 부가정보에 쌓인다.

## 실행

```sh
sh run.sh                  # 또는  powershell -File run.ps1
# http://127.0.0.1:8090
```

엔드포인트 세 값은 `var/secrets.env`에서 읽는다(저장소에 올라가지 않는다):
`DEMO_MSA_LLM_API_BASE`, `DEMO_MSA_LLM_MODEL`, `DEMO_MSA_LLM_API_KEY`.

## 화면

- 위: 파일 선택 + 실행 + 상태
- 아래 왼쪽 2/3: 추출된 기본정보 행 목록
- 아래 오른쪽 1/3: 선택한 행의 `항목명 · 값` (기본 여섯 항목 + 부가정보)

## 반드시 지킬 것

- **모델은 gpt-oss-120b 하나다.** 등록부·공급자 어댑터·파라미터 카탈로그를 되살리지 않는다.
- **백엔드는 표준 라이브러리만 쓴다.** 문서 파서도 zip+XML과 OLE 판독으로 직접 읽는다.
- **프론트엔드는 `src/frontend/index.html` 한 파일이다.** 빌드 도구를 넣지 않는다.
- **API 키는 `var/secrets.env`에만 둔다.** 외부 오류 본문은 `scrub()`을 거친다.

## 검증

```sh
cd src/backend && python -m unittest discover -s tests -t tests   # 9건
```
