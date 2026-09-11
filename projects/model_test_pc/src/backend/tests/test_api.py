import base64
import json
import os
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from app.main import build_server

from .support import FakeProviderServer, make_config, point_models_at
from .test_documents import make_xlsx


class ApiTest(unittest.TestCase):
    """실제 HTTP 서버를 띄우고, 모델 호출은 가짜 공급자 서버로 받는다."""

    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory()
        cls.fake = FakeProviderServer()
        os.environ["TEST_API_KEY"] = "test-key"
        root = Path(cls._tmp.name)
        cls.config = make_config(root)
        point_models_at(cls.config.models_dir, cls.fake.base_url)
        cls.server, cls.services = build_server(cls.config)
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}/api/v1"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)
        cls.fake.close()
        cls._tmp.cleanup()
        os.environ.pop("TEST_API_KEY", None)

    def request(self, method: str, path: str, payload: dict | None = None) -> tuple[int, dict]:
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = urllib.request.Request(
            f"{self.base}{path}", data=data,
            headers={"Content-Type": "application/json"}, method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return response.status, json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read() or b"{}")

    def stream(self, payload: dict) -> list[dict]:
        request = urllib.request.Request(
            f"{self.base}/generate", data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}, method="POST",
        )
        events = []
        with urllib.request.urlopen(request, timeout=30) as response:
            self.assertTrue(response.headers["Content-Type"].startswith("text/event-stream"))
            for raw in response:
                line = raw.decode("utf-8").strip()
                if line.startswith("data:"):
                    events.append(json.loads(line[5:].strip()))
        return events

    def test_01_health_and_models(self) -> None:
        status, health = self.request("GET", "/health")
        self.assertEqual((status, health["status"], health["models"]), (200, "ok", 2))

        status, models = self.request("GET", "/models")
        self.assertEqual(status, 200)
        self.assertEqual([model["id"] for model in models["models"]], ["endpoint-llm", "vision-api"])
        self.assertTrue(all(model["label"].endswith(("(LLM)", "(VLM)")) for model in models["models"]))

    def test_02_no_serving_endpoints_exist(self) -> None:
        # 이 프로젝트는 모델을 서빙하지 않는다. 관련 경로가 남아 있으면 안 된다.
        for method, path in (("GET", "/serving"), ("POST", "/serving"), ("DELETE", "/serving"),
                             ("GET", "/serving/logs")):
            with self.subTest(path=path):
                self.assertEqual(self.request(method, path)[0], 404)

    def test_03_models_can_be_filtered_by_modality(self) -> None:
        _, vlm = self.request("GET", "/models?modality=VLM")
        self.assertEqual([model["id"] for model in vlm["models"]], ["vision-api"])

    def test_04_parameters_follow_the_model_profile(self) -> None:
        _, endpoint = self.request("GET", "/parameters?model_id=endpoint-llm")
        keys = {spec["key"] for spec in endpoint["parameters"]}
        self.assertIn("reasoning_effort", keys)
        self.assertIn("repetition_penalty", keys)  # vLLM 프로필은 확장 필드를 받는다
        self.assertEqual(endpoint["defaults"]["max_tokens"], 512)

        _, api = self.request("GET", "/parameters?model_id=vision-api")
        api_keys = {spec["key"] for spec in api["parameters"]}
        self.assertNotIn("repetition_penalty", api_keys)
        self.assertIn("temperature", api_keys)

        self.assertEqual(self.request("GET", "/parameters")[0], 422)

    def test_05_generate_streams_and_saves_only_on_request(self) -> None:
        events = self.stream({
            "model_id": "endpoint-llm",
            "prompt": "안녕하세요",
            "system_prompt": "너는 친절한 비서다.",
            "parameters": {"temperature": 0.2, "reasoning_effort": "high", "show_thinking": True},
        })

        types = [event["type"] for event in events]
        self.assertEqual((types[0], types[-1]), ("start", "done"))
        self.assertIn("reasoning", types)

        run = events[-1]["run"]
        self.assertIn("안녕하세요", run["text"])
        self.assertEqual(run["model_id"], "endpoint-llm")
        self.assertEqual(run["provider_type"], "openai")

        _, before = self.request("GET", "/runs")
        self.assertNotIn(run["id"], [item["id"] for item in before["runs"]])

        self.assertEqual(self.request("POST", "/runs", {"run": run})[0], 201)
        _, after = self.request("GET", "/runs")
        self.assertEqual(after["runs"][0]["id"], run["id"])

    def test_06_generate_without_streaming(self) -> None:
        status, body = self.request("POST", "/generate", {
            "model_id": "vision-api", "prompt": "짧게", "stream": False,
        })
        self.assertEqual(status, 200)
        self.assertTrue(body["run"]["text"])

    def test_07_generate_rejects_bad_input(self) -> None:
        empty = self.request("POST", "/generate", {"model_id": "endpoint-llm", "prompt": " ", "stream": False})
        self.assertEqual((empty[0], empty[1]["error"]["code"]), (422, "empty_prompt"))

        no_model = self.request("POST", "/generate", {"prompt": "안녕", "stream": False})
        self.assertEqual((no_model[0], no_model[1]["error"]["code"]), (422, "model_id_required"))

        ghost = self.request("POST", "/generate", {"model_id": "ghost", "prompt": "안녕", "stream": False})
        self.assertEqual(ghost[0], 404)

        bad = self.request("POST", "/generate", {
            "model_id": "endpoint-llm", "prompt": "안녕", "stream": False, "parameters": {"temperature": 5},
        })
        self.assertEqual(bad[0], 422)

    def test_08_images_are_rejected_for_llm_models(self) -> None:
        status, body = self.request("POST", "/generate", {
            "model_id": "endpoint-llm", "prompt": "이 그림은?", "stream": False,
            "images": [{"name": "a.png", "data_url": "data:image/png;base64,AAAA"}],
        })
        self.assertEqual((status, body["error"]["code"]), (422, "images_not_supported"))

    def test_09_judges_list_every_registered_model(self) -> None:
        _, judges = self.request("GET", "/judges")
        self.assertEqual({model["id"] for model in judges["models"]}, {"endpoint-llm", "vision-api"})

    def test_10_runs_can_be_compared_and_deleted(self) -> None:
        runs = []
        for temperature in (0.1, 0.9):
            run = self.request("POST", "/generate", {
                "model_id": "endpoint-llm", "prompt": "A", "stream": False,
                "parameters": {"temperature": temperature},
            })[1]["run"]
            self.assertEqual(self.request("POST", "/runs", {"run": run})[0], 201)
            runs.append(run)

        status, comparison = self.request("POST", "/runs/compare", {"run_ids": [run["id"] for run in runs]})
        self.assertEqual(status, 200)
        self.assertEqual([item["key"] for item in comparison["parameter_differences"]], ["temperature"])

        # 모범답변 없이 비교 모델만 골라도 채점이 돌아간다
        _, judged = self.request("POST", "/runs/compare", {
            "run_ids": [run["id"] for run in runs], "reference": "", "judge_model_id": "endpoint-llm",
        })
        self.assertEqual(judged["judgement"]["judge_model_id"], "endpoint-llm")
        self.assertNotIn("[모범답변]", self.fake.requests[-1]["body"]["messages"][1]["content"])

        # 모범답변만 있고 비교 모델이 없으면 안내만 한다
        _, unjudged = self.request("POST", "/runs/compare", {
            "run_ids": [run["id"] for run in runs], "reference": "정답", "judge_model_id": "",
        })
        self.assertIn("skipped", unjudged["judgement"])

        self.assertEqual(self.request("DELETE", f"/runs/{runs[0]['id']}")[0], 200)
        self.assertEqual(self.request("GET", f"/runs/{runs[0]['id']}")[0], 404)

    def test_11_documents_are_parsed_on_upload(self) -> None:
        encoded = base64.b64encode(make_xlsx()).decode()
        status, parsed = self.request("POST", "/documents/parse", {
            "name": "평가.xlsx", "data_url": f"data:application/octet-stream;base64,{encoded}",
        })
        self.assertEqual((status, parsed["kind"]), (200, "xlsx"))
        self.assertIn("평가표", parsed["text"])

        status, body = self.request("POST", "/documents/parse", {
            "name": "그림.png", "data_url": "data:image/png;base64,AAAA",
        })
        self.assertEqual((status, body["error"]["code"]), (422, "unsupported_document"))

    def test_12_unknown_routes_and_methods(self) -> None:
        self.assertEqual(self.request("GET", "/nope")[0], 404)
        self.assertEqual(self.request("DELETE", "/models")[0], 405)


if __name__ == "__main__":
    unittest.main()
