"""문서 평문에서 BOM 기본정보를 뽑아낸다. 모델은 gpt-oss-120b 하나만 쓴다."""

from __future__ import annotations

import json
import logging
import re
import urllib.error
import urllib.request

from ..config import Config
from ..core.errors import ApiError
from .secrets import get_secret, scrub

logger = logging.getLogger("app.extract")

MODEL_ID = "gpt-oss-120b"
BASE_URL_ENV = "DEMO_MSA_LLM_API_BASE"
MODEL_ENV = "DEMO_MSA_LLM_MODEL"
API_KEY_ENV = "DEMO_MSA_LLM_API_KEY"

BASIC_FIELDS = ("표준물질명", "데이터유형", "CAS번호", "지역", "년도", "공정")
DATA_TYPES = ("제품", "자재", "물질")
MAX_TOKENS = 8192

SYSTEM_PROMPT = f"""당신은 BOM(자재명세) 문서에서 표준물질 기본정보를 추출하는 분석기다.
문서에 등장하는 품목마다 한 행을 만든다. 규칙:

1. 기본정보 항목은 {", ".join(BASIC_FIELDS)} 여섯 가지다.
2. 데이터유형은 품목 성격으로 분류해 {", ".join(DATA_TYPES)} 중 하나를 반드시 고른다.
   화학물질·원료는 `물질`, 부품·원자재·부자재는 `자재`, 완성품·조립품은 `제품`이다.
   끝까지 판단이 서지 않을 때만 비우고 부가정보에 `추정 데이터유형`으로 남긴다.
3. CAS번호는 `숫자-숫자-숫자` 형식일 때만 적는다.
4. 년도는 네 자리 연도만 적는다.
5. 문서에 근거가 있는 값만 기본정보에 적는다. 근거가 없으면 빈 문자열("")로 둔다.
6. 기본정보 여섯 항목에 해당하지 않는 정보(규격, 수량, 단위, 공급사, 용도 등)와,
   문서에 직접 적혀 있지 않아 추측한 값은 `부가정보` 배열에 {{"항목명", "값"}}으로 담는다.
   추측한 기본정보는 항목명을 `추정 지역`처럼 `추정 `으로 시작하게 적는다.

JSON만 출력한다. 설명·주석·코드펜스를 붙이지 않는다. 형식:
{{"rows": [{{"표준물질명": "", "데이터유형": "", "CAS번호": "", "지역": "", "년도": "",
  "공정": "", "부가정보": [{{"항목명": "", "값": ""}}]}}]}}"""

_CAS = re.compile(r"^\d{2,7}-\d{2}-\d$")
_YEAR = re.compile(r"(19|20)\d{2}")


def endpoint() -> tuple[str, str, str]:
    """엔드포인트·모델명·API 키. 하나라도 비면 무엇이 빠졌는지 알려 준다."""
    base_url = (get_secret(BASE_URL_ENV) or "").rstrip("/")
    remote_model = get_secret(MODEL_ENV) or MODEL_ID
    key = get_secret(API_KEY_ENV) or ""
    if not base_url or not key:
        missing = [name for name, value in ((BASE_URL_ENV, base_url), (API_KEY_ENV, key)) if not value]
        raise ApiError(
            400,
            "endpoint_not_configured",
            f"{MODEL_ID} 엔드포인트 설정이 비어 있습니다({', '.join(missing)}). var/secrets.env를 확인해 주세요.",
        )
    return base_url, remote_model, key


def extract(config: Config, documents: list[dict]) -> dict:
    """문서 목록을 한 번의 호출로 처리하고 `{rows, model, usage}`를 준다."""
    base_url, remote_model, key = endpoint()
    body = {
        "model": remote_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _user_prompt(documents)},
        ],
        "stream": False,
        "temperature": 0,
        "max_tokens": MAX_TOKENS,
        "reasoning_effort": "low",
    }
    payload = _post(config, f"{base_url}/chat/completions", body, key)
    choice = (payload.get("choices") or [{}])[0]
    content = (choice.get("message") or {}).get("content") or ""
    rows = normalize(parse_rows(content))
    return {"rows": rows, "model": MODEL_ID, "usage": payload.get("usage") or {}}


def _user_prompt(documents: list[dict]) -> str:
    parts = [f"### 파일: {doc['name']} ({doc['kind']})\n{doc['text']}" for doc in documents]
    return "다음 문서에서 기본정보 행을 추출해 JSON으로 답하라.\n\n" + "\n\n".join(parts)


def _post(config: Config, url: str, body: dict, key: str) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=config.request_timeout) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        detail = scrub(exc.read().decode("utf-8", errors="replace")[:500])
        raise ApiError(502, "provider_error", f"{MODEL_ID} 호출이 거부되었습니다: {detail}") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise ApiError(504, "provider_unreachable", f"{MODEL_ID} 엔드포인트에 연결할 수 없습니다: {exc}") from exc
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ApiError(502, "provider_error", f"{MODEL_ID} 응답을 JSON으로 해석할 수 없습니다: {exc}") from exc


def parse_rows(content: str) -> list[dict]:
    """모델 답변에서 rows 배열을 꺼낸다. 코드펜스·앞뒤 잡글을 견딘다."""
    text = content.strip()
    fenced = re.search(r"```(?:json)?\s*(.+?)```", text, re.S)
    if fenced:
        text = fenced.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise ApiError(502, "invalid_model_output", "모델 답변에서 JSON을 찾지 못했습니다.")
    try:
        payload = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ApiError(502, "invalid_model_output", f"모델이 내놓은 JSON을 해석할 수 없습니다: {exc}") from exc
    rows = payload.get("rows") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise ApiError(502, "invalid_model_output", "모델 답변에 rows 배열이 없습니다.")
    return [row for row in rows if isinstance(row, dict)]


def normalize(rows: list[dict]) -> list[dict]:
    """기본정보 여섯 칸을 채우고, 규격에 맞지 않거나 남은 값은 모두 부가정보로 옮긴다."""
    out = []
    for row in rows:
        basic = {field: _clean(row.get(field)) for field in BASIC_FIELDS}
        extras = _extras(row.get("부가정보"))

        if basic["데이터유형"] not in DATA_TYPES:
            extras = _move(extras, "데이터유형", basic["데이터유형"])
            basic["데이터유형"] = ""
        if basic["CAS번호"] and not _CAS.match(basic["CAS번호"]):
            extras = _move(extras, "CAS번호", basic["CAS번호"])
            basic["CAS번호"] = ""
        year = _YEAR.search(basic["년도"])
        if basic["년도"] and not year:
            extras = _move(extras, "년도", basic["년도"])
        basic["년도"] = year.group(0) if year else ""

        # 모델이 스키마 밖 키를 덧붙여도 버리지 않는다.
        for key, value in row.items():
            if key in BASIC_FIELDS or key == "부가정보":
                continue
            cleaned = _clean(value) if not isinstance(value, (dict, list)) else json.dumps(value, ensure_ascii=False)
            if cleaned:
                extras.append({"항목명": str(key), "값": cleaned})

        out.append({**basic, "부가정보": extras})
    return out


def _extras(value) -> list[dict]:
    if not isinstance(value, list):
        return []
    extras = []
    for item in value:
        if not isinstance(item, dict):
            continue
        name = _clean(item.get("항목명") or item.get("name"))
        cleaned = _clean(item.get("값") or item.get("value"))
        if name and cleaned:
            extras.append({"항목명": name, "값": cleaned})
    return extras


def _move(extras: list[dict], field: str, value: str) -> list[dict]:
    """기본정보 규격에 맞지 않은 값은 `추정 <항목>`으로 부가정보에 남긴다."""
    if value:
        extras.append({"항목명": f"추정 {field}", "값": value})
    return extras


def _clean(value) -> str:
    if value is None or isinstance(value, bool):
        return ""
    return " ".join(str(value).split()).strip()
