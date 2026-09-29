"""API 라우팅. 경로는 두 개뿐이다: 상태 확인과 추출."""

from __future__ import annotations

from ..config import Config
from ..core.errors import ApiError
from ..core.http import Router
from ..services import extract as extract_service
from ..services.documents import SUPPORTED, parse_data_url, parse_document

MAX_FILES = 5


def build_router(config: Config) -> Router:
    router = Router()

    @router.get("/api/v1/health")
    def health(_request):
        try:
            base_url, remote_model, _ = extract_service.endpoint()
            ready, detail = True, f"{remote_model} @ {base_url}"
        except ApiError as error:
            ready, detail = False, error.message
        return {
            "model": extract_service.MODEL_ID,
            "ready": ready,
            "detail": detail,
            "supported": list(SUPPORTED),
            "fields": list(extract_service.BASIC_FIELDS),
            "max_files": MAX_FILES,
        }

    @router.post("/api/v1/extract")
    def run(request):
        files = request.json().get("files")
        if not isinstance(files, list) or not files:
            raise ApiError(422, "no_files", "추출할 파일을 한 개 이상 올려 주세요.")
        if len(files) > MAX_FILES:
            raise ApiError(422, "too_many_files", f"한 번에 올릴 수 있는 파일은 {MAX_FILES}개까지입니다.")
        documents = []
        for item in files:
            if not isinstance(item, dict):
                raise ApiError(422, "invalid_files", "files 항목은 {name, data} 객체여야 합니다.")
            name = str(item.get("name") or "").strip() or "unnamed"
            documents.append(parse_document(name, parse_data_url(name, item.get("data"))))
        result = extract_service.extract(config, documents)
        result["documents"] = [{key: doc[key] for key in ("name", "kind", "chars", "truncated")} for doc in documents]
        return result

    return router
