import json
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from app.main import build_server

from .support import StubEngine, make_config


class ApiTest(unittest.TestCase):
    """Drives the real HTTP server end to end with the stub engine."""

    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory()
        cls.config = make_config(Path(cls._tmp.name))
        cls.server, cls.services = build_server(cls.config, StubEngine(cls.config))
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}/api/v1"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.services.manager.shutdown()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)
        cls._tmp.cleanup()

    def request(self, method: str, path: str, payload: dict | None = None) -> tuple[int, dict]:
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = urllib.request.Request(
            f"{self.base}{path}",
            data=data,
            headers={"Content-Type": "application/json"},
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return response.status, json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read() or b"{}")

    def serve_and_wait(self, model_id: str) -> dict:
        status, _ = self.request("POST", "/serving", {"model_id": model_id})
        self.assertEqual(status, 202)
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            _, body = self.request("GET", "/serving")
            if body["status"] in {"ready", "error"}:
                return body
            time.sleep(0.05)
        self.fail("serving did not become ready")

    def stream(self, path: str, payload: dict) -> list[dict]:
        request = urllib.request.Request(
            f"{self.base}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
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
        self.assertEqual((status, health["status"], health["engine"]), (200, "ok", "stub"))

        status, models = self.request("GET", "/models")
        self.assertEqual(status, 200)
        self.assertEqual([model["id"] for model in models["models"]], ["plain", "reasoner"])
        self.assertEqual(models["providers"], ["Local"])
        self.assertEqual(models["modalities"], ["LLM"])

    def test_02_generate_requires_a_served_model(self) -> None:
        status, body = self.request("POST", "/generate", {"prompt": "안녕하세요", "stream": False})
        self.assertEqual(status, 409)
        self.assertEqual(body["error"]["code"], "model_not_ready")

    def test_03_serving_switch_keeps_one_model(self) -> None:
        self.assertEqual(self.serve_and_wait("reasoner")["model_id"], "reasoner")
        body = self.serve_and_wait("plain")

        self.assertEqual(body["model_id"], "plain")
        self.assertEqual(body["status"], "ready")
        _, logs = self.request("GET", "/serving/logs?tail=50")
        self.assertTrue(any("'plain' 서빙을 시작" in line for line in logs["lines"]))

    def test_04_parameters_follow_the_served_model(self) -> None:
        self.serve_and_wait("plain")
        _, plain = self.request("GET", "/parameters")
        self.assertNotIn("reasoning_effort", {spec["key"] for spec in plain["parameters"]})

        self.serve_and_wait("reasoner")
        _, reasoner = self.request("GET", "/parameters")
        self.assertIn("reasoning_effort", {spec["key"] for spec in reasoner["parameters"]})
        self.assertEqual(reasoner["defaults"]["max_tokens"], 512)

    def test_05_generate_streams_and_saves_only_on_request(self) -> None:
        self.serve_and_wait("reasoner")
        events = self.stream(
            "/generate",
            {
                "prompt": "LCA 리포트는 무엇인가요?",
                "system_prompt": "너는 친절한 한국어 비서다.",
                "parameters": {"temperature": 0.2, "reasoning_effort": "high", "show_thinking": True},
            },
        )

        types = [event["type"] for event in events]
        self.assertEqual(types[0], "start")
        self.assertEqual(types[-1], "done")
        self.assertIn("delta", types)
        self.assertIn("reasoning", types)

        done = events[-1]["run"]
        self.assertIn("LCA", done["text"])
        self.assertEqual(done["parameters"]["temperature"], 0.2)
        self.assertEqual(done["model_id"], "reasoner")
        self.assertGreater(done["usage"]["total_tokens"], 0)

        # 저장 버튼을 누르기 전에는 아무것도 기록되지 않는다.
        _, before = self.request("GET", "/runs")
        self.assertNotIn(done["id"], [item["id"] for item in before["runs"]])

        status, saved = self.request("POST", "/runs", {"run": done})
        self.assertEqual((status, saved["saved"]), (201, done["id"]))
        _, after = self.request("GET", "/runs")
        self.assertEqual(after["runs"][0]["id"], done["id"])

    def test_06_generate_without_streaming_returns_one_run(self) -> None:
        self.serve_and_wait("reasoner")
        status, body = self.request("POST", "/generate", {"prompt": "짧게 답해줘", "stream": False})

        self.assertEqual(status, 200)
        self.assertTrue(body["run"]["text"])
        self.assertIsNotNone(body["run"]["latency_ms"])

    def test_07_generate_rejects_bad_input(self) -> None:
        self.serve_and_wait("reasoner")
        empty = self.request("POST", "/generate", {"prompt": "  ", "stream": False})
        self.assertEqual((empty[0], empty[1]["error"]["code"]), (422, "empty_prompt"))

        bad_param = self.request("POST", "/generate", {"prompt": "hi", "stream": False, "parameters": {"temperature": 5}})
        self.assertEqual(bad_param[0], 422)

        mismatch = self.request("POST", "/generate", {"prompt": "hi", "stream": False, "model_id": "plain"})
        self.assertEqual((mismatch[0], mismatch[1]["error"]["code"]), (409, "model_mismatch"))

    def test_08_runs_can_be_compared_and_deleted(self) -> None:
        self.serve_and_wait("reasoner")
        first = self.request("POST", "/generate", {"prompt": "A", "stream": False, "parameters": {"temperature": 0.1}})[1]["run"]
        second = self.request("POST", "/generate", {"prompt": "A", "stream": False, "parameters": {"temperature": 0.9}})[1]["run"]
        for run in (first, second):
            self.assertEqual(self.request("POST", "/runs", {"run": run})[0], 201)

        status, comparison = self.request("POST", "/runs/compare", {"run_ids": [first["id"], second["id"]]})
        self.assertEqual(status, 200)
        self.assertEqual([item["key"] for item in comparison["parameter_differences"]], ["temperature"])

        self.assertEqual(self.request("DELETE", f"/runs/{first['id']}")[0], 200)
        self.assertEqual(self.request("GET", f"/runs/{first['id']}")[0], 404)

    def test_08b_saving_rejects_incomplete_runs(self) -> None:
        self.assertEqual(self.request("POST", "/runs", {"run": {"id": "x"}})[0], 422)
        self.assertEqual(self.request("POST", "/runs", {})[0], 422)

    def test_09_stop_serving_returns_to_idle(self) -> None:
        self.serve_and_wait("reasoner")
        status, body = self.request("DELETE", "/serving")

        self.assertEqual((status, body["status"]), (200, "idle"))
        self.assertIsNone(body["model"])

    def test_11_models_can_be_filtered_by_modality(self) -> None:
        _, all_models = self.request("GET", "/models")
        self.assertTrue(all(model["label"].endswith("(LLM)") or model["label"].endswith("(VLM)")
                            for model in all_models["models"]))

        _, vlm = self.request("GET", "/models?modality=VLM")
        self.assertTrue(all(model["modality"] == "VLM" for model in vlm["models"]))

    def test_12_images_are_rejected_for_llm_models(self) -> None:
        self.serve_and_wait("reasoner")
        status, body = self.request("POST", "/generate", {
            "prompt": "이 그림은?", "stream": False,
            "images": [{"name": "a.png", "data_url": "data:image/png;base64,AAAA"}],
        })
        self.assertEqual((status, body["error"]["code"]), (422, "images_not_supported"))

    def test_10_unknown_routes_and_methods(self) -> None:
        self.assertEqual(self.request("GET", "/nope")[0], 404)
        self.assertEqual(self.request("DELETE", "/models")[0], 405)
        self.assertEqual(self.request("POST", "/serving", {"model_id": "ghost"})[0], 404)
        self.assertEqual(self.request("POST", "/serving", {})[0], 422)


if __name__ == "__main__":
    unittest.main()
