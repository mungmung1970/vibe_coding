"""HTTP surface of the model test console."""

from __future__ import annotations

import itertools

from ..config import Config
from ..core.errors import ApiError
from ..core.http import Request, Response, Router, json_response, sse_response
from ..services.history import HistoryStore
from ..services.inference import InferenceService
from ..services.judge import JudgeService
from ..services.model_registry import ModelRegistry
from ..services.parameter_catalog import ParameterCatalog
from ..services.serving_manager import ServingManager

API = "/api/v1"


def _int_param(request: Request, key: str, default: int) -> int:
    raw = request.query.get(key)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        raise ApiError(400, "invalid_query", f"{key}는 정수여야 합니다.") from None


def _wants_stream(payload: dict) -> bool:
    value = payload.get("stream")
    if value is None:
        value = (payload.get("parameters") or {}).get("stream", True)
    if isinstance(value, str):
        return value.lower() != "false"
    return bool(value)


def build_router(
    config: Config,
    registry: ModelRegistry,
    catalog: ParameterCatalog,
    manager: ServingManager,
    inference: InferenceService,
    history: HistoryStore,
    judge: JudgeService,
) -> Router:
    router = Router()

    @router.get(f"{API}/health")
    def health(_: Request) -> dict:
        return {
            "status": "ok",
            "engine": manager.engine.name,
            "serving": manager.status()["status"],
            "models_dir": str(config.models_dir),
        }

    @router.get(f"{API}/models")
    def list_models(request: Request) -> dict:
        models = registry.list()
        modality = (request.query.get("modality") or "").upper()
        if modality in {"LLM", "VLM"}:
            models = [model for model in models if model.modality == modality]
        return {
            "models": [model.to_dict() for model in models],
            "providers": sorted({model.provider for model in models}),
            "modalities": sorted({model.modality for model in models}),
            "models_dir": str(config.models_dir),
        }

    @router.get(f"{API}/models/{{model_id}}")
    def get_model(request: Request) -> dict:
        return registry.get(request.params["model_id"]).to_dict()

    @router.get(f"{API}/judges")
    def judges(_: Request) -> dict:
        return {"models": judge.candidates()}

    @router.get(f"{API}/serving")
    def serving_status(_: Request) -> dict:
        return manager.status()

    @router.post(f"{API}/serving")
    def start_serving(request: Request) -> Response:
        payload = request.json()
        model_id = str(payload.get("model_id") or "").strip()
        if not model_id:
            raise ApiError(422, "model_id_required", "서빙할 model_id가 필요합니다.")
        return json_response(manager.serve(model_id), status=202)

    @router.delete(f"{API}/serving")
    def stop_serving(_: Request) -> dict:
        return manager.stop()

    @router.get(f"{API}/serving/logs")
    def serving_logs(request: Request) -> dict:
        return manager.logs(_int_param(request, "tail", 200))

    @router.get(f"{API}/parameters")
    def parameters(request: Request) -> dict:
        model_id = request.query.get("model_id")
        model = registry.get(model_id) if model_id else manager.active_model()
        return catalog.schema_for(model)

    @router.post(f"{API}/generate")
    def generate(request: Request) -> Response:
        payload = request.json()
        events = inference.generate(payload)
        first = next(events)
        if _wants_stream(payload):
            return sse_response(itertools.chain([first], events))
        run = None
        for event in itertools.chain([first], events):
            if event["type"] == "error":
                error = event["error"]
                raise ApiError(event.get("status", 502), error["code"], error["message"])
            if event["type"] == "done":
                run = event["run"]
        return json_response({"run": run})

    @router.get(f"{API}/runs")
    def list_runs(request: Request) -> dict:
        runs = history.list(
            model_id=request.query.get("model_id"),
            query=request.query.get("q"),
            date_from=request.query.get("from"),
            date_to=request.query.get("to"),
            limit=_int_param(request, "limit", 100),
        )
        return {"runs": runs, "count": len(runs)}

    @router.post(f"{API}/runs")
    def save_run(request: Request) -> Response:
        """저장 버튼으로만 기록이 남는다. 생성 자체는 아무것도 저장하지 않는다."""
        payload = request.json()
        run = payload.get("run")
        if not isinstance(run, dict) or not run.get("id") or not run.get("text"):
            raise ApiError(422, "invalid_run", "저장할 실행 결과(run)가 올바르지 않습니다.")
        history.append(run)
        return json_response({"saved": run["id"]}, status=201)

    @router.post(f"{API}/runs/compare")
    def compare_runs(request: Request) -> dict:
        payload = request.json()
        run_ids = payload.get("run_ids")
        if not isinstance(run_ids, list):
            raise ApiError(422, "invalid_run_ids", "run_ids는 실행 id 배열이어야 합니다.")
        result = history.compare([str(run_id) for run_id in run_ids])
        reference = str(payload.get("reference") or "").strip()
        judge_model_id = str(payload.get("judge_model_id") or "").strip()
        if reference and judge_model_id:
            result["judgement"] = judge.evaluate(judge_model_id, reference, result["runs"])
        elif reference:
            result["judgement"] = {"skipped": "심판 모델을 선택하면 모범답변과 대조해 채점합니다."}
        return result

    @router.get(f"{API}/runs/{{run_id}}")
    def get_run(request: Request) -> dict:
        return history.get(request.params["run_id"])

    @router.delete(f"{API}/runs/{{run_id}}")
    def delete_run(request: Request) -> dict:
        history.delete(request.params["run_id"])
        return {"deleted": request.params["run_id"]}

    return router
