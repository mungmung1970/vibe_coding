# pipeline — PDF → 엑셀 → DOCX / HWPX

스캔 PDF 양식을 읽어 항목을 뽑고, 엑셀로 저장한 뒤, **그 엑셀을 다시 읽어** XML 로 매핑해
원본과 비슷한 DOCX·HWPX 를 만든다. 문서 내용은 전부 모델이 읽은 것이고 사람이 옮겨 적은 것은 없다.

```sh
node pipeline/run.js                      # 전체 실행 (test/ 의 샘플 PDF)
node pipeline/run.js /경로/양식.pdf        # 다른 PDF
node pipeline/run.js --skip-extract       # 판독은 건너뛰고 out/doc.json 재사용
```

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `LLM_BASE` | `http://127.0.0.1:8000/v1` | OpenAI 호환 엔드포인트 (vLLM) |
| `LLM_MODEL` | `qwen3.8-27b` | 판독에 쓰는 모델 (VLM 이어야 한다) |
| `PDF_DPI` | `200` | 페이지 렌더링 해상도 |
| `TEMPLATE` | `executive` | `formats.js` 의 `DOC_TEMPLATES` 키 |

## 단계

| 파일 | 하는 일 |
| --- | --- |
| `extract.js` | PDF → 페이지 PNG(`pdftoppm`) → VLM 판독 → `out/doc.json` |
| `toxlsx.js` | `doc.json` → `out/*_파싱.xlsx` (8시트, 마지막이 `XML매핑`) |
| `form.js` | 엑셀 → 모델 → DOCX / HWPX |
| `verify.js` | 파트 구성 · XML 적격성 · HWPX ID 참조 · DOCX 격자 합 · 엑셀 왕복 |
| `fieldmap.js` | 항목 ↔ DOCX 경로 ↔ HWPX 경로 ↔ 서식 (`formats.js` 의 `FIELD_MAP` 과 같은 역할) |
| `ocr.js` | 스캔 페이지 → 텍스트(tesseract). 텍스트 전용 모델용 판독 경로 |
| `harness.js` | 브라우저용 `app.js`/`formats.js`/`hwpx.js` 를 Node 에서 그대로 쓰기 위한 껍데기 |
| `xlsx.js` | 의존성 없는 XLSX 쓰기/읽기 (`zip()` 재사용) |

## 텍스트 전용 모델로 돌리기

`gpt-oss-120b` 처럼 이미지를 못 보는 모델은 OCR 을 거친다.

```sh
EXTRACT_MODE=text LLM_MODEL=gpt-oss-120b OUT_DIR=out_gptoss node pipeline/run.js
```

tesseract 는 시스템 설치(`/usr/bin/tesseract`)를 쓰고, 없으면 `TESS_HOME`(기본 `~/opt/tess`)에
deb 를 풀어 둔 것을 쓴다. 한국어는 `tessdata_best` 의 `kor_best` 가 기본 `kor` 보다 낫다.

**다만 이 양식에서는 OCR 품질이 한계다.** 색 배경 셀과 다단 표에서 글자가 무너져(600dpi 로 올려도 같다)
조직·역할 표와 평가 절차 표가 통째로 비었다. 스캔 양식은 VLM 직접 판독 쪽이 확실히 낫다.

## 판독 단계에서 붙잡은 것들

- 이 PDF 는 **텍스트 레이어가 없다**(페이지가 JPEG). `pdftotext` 결과가 0바이트라 VLM 으로 읽는다.
- 칸 폭 때문에 접힌 줄은 모델이 매번 다르게 처리한다 → 글머리표(`•` `①` `→` …)가 없는 항목은
  앞 항목에 이어 붙이는 규칙(`joinWrapped`)으로 확정한다.
- 잔글씨 표는 200dpi 에서 오독한다(`허용 불가능` → `허용 불가`). `REFINE` 에 좌표를 적어 두면
  그 영역만 600dpi 로 잘라 다시 읽는다.
- 판독 뒤 같은 페이지 이미지와 JSON 을 함께 넣어 **대조 교정** 한 번(`매일` → `매월` 을 이 단계가 잡았다).

## 표 폭

`hwpx.js` 의 `hwpTable` 은 열 폭을 균등 분할한다. 그래서 공용 빌더를 고치지 않고
**24칸 격자 + `colSpan`** 으로 비대칭 열 폭을 만든다(`form.js` 의 `G`). DOCX 도 같은 격자를 쓴다.

## 아직 못 한 검증

`verify.js` 는 구조만 본다. **한글(HWP)·워드에서 실제로 열어 본 검증은 아직이다** — DOCX 는
LibreOffice 로 PDF 변환해 눈으로 확인했고, HWPX 는 LibreOffice 가 열지 못해 구조 검사만 했다.
