import json
import os
import tempfile
import unittest
from pathlib import Path

from app.core.errors import ApiError
from app.services.model_registry import ModelRegistry

from .support import make_models_dir


class ModelRegistryTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.models_dir = make_models_dir(self.root)
        self.registry = ModelRegistry(self.models_dir)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _write(self, name: str, meta: dict) -> None:
        directory = self.models_dir / name
        directory.mkdir(exist_ok=True)
        (directory / "model.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    def test_lists_registered_endpoints(self) -> None:
        ids = [model.id for model in self.registry.list()]

        self.assertEqual(ids, ["endpoint-llm", "vision-api"])
        self.assertEqual(self.registry.providers(), ["OpenAI", "사내 엔드포인트"])
        self.assertEqual(self.registry.get("endpoint-llm").label, "Endpoint LLM (LLM)")
        self.assertEqual(self.registry.get("vision-api").label, "Vision API (VLM)")

    def test_base_url_can_come_from_an_environment_variable(self) -> None:
        self._write("from-env", {"id": "from-env", "base_url": "${TEST_ENDPOINT_URL}"})

        os.environ["TEST_ENDPOINT_URL"] = "http://endpoint.internal:8000/v1/"
        try:
            self.assertEqual(self.registry.get("from-env").base_url, "http://endpoint.internal:8000/v1")
        finally:
            del os.environ["TEST_ENDPOINT_URL"]

    def test_remote_model_can_come_from_an_environment_variable(self) -> None:
        self._write("from-model-env", {
            "id": "from-model-env",
            "base_url": "http://endpoint.internal/v1",
            "remote_model": "${TEST_REMOTE_MODEL}",
        })

        os.environ["TEST_REMOTE_MODEL"] = "/models/gpt-oss-120b"
        try:
            self.assertEqual(self.registry.get("from-model-env").remote_model, "/models/gpt-oss-120b")
        finally:
            del os.environ["TEST_REMOTE_MODEL"]

    def test_entries_without_a_base_url_are_skipped(self) -> None:
        # 주소가 비면 호출할 수 없으므로 목록에 넣지 않는다.
        self._write("no-url", {"id": "no-url"})
        self._write("unset-env", {"id": "unset-env", "base_url": "${TEST_MISSING_URL}"})

        ids = [model.id for model in self.registry.list()]
        self.assertNotIn("no-url", ids)
        self.assertNotIn("unset-env", ids)

    def test_unknown_provider_type_is_skipped(self) -> None:
        self._write("bad", {"id": "bad", "provider_type": "cohere", "base_url": "http://x/v1"})

        self.assertNotIn("bad", [model.id for model in self.registry.list()])

    def test_parameter_profile_defaults_to_provider_type(self) -> None:
        self.assertEqual(self.registry.get("vision-api").profile, "openai")
        self.assertEqual(self.registry.get("endpoint-llm").profile, "vllm")

    def test_key_readiness_is_reported(self) -> None:
        endpoint = self.registry.get("endpoint-llm")
        keyed = self.registry.get("vision-api")

        self.assertFalse(endpoint.needs_key)
        self.assertTrue(endpoint.key_ready)
        self.assertTrue(keyed.needs_key)
        self.assertFalse(keyed.key_ready)

        os.environ["TEST_API_KEY"] = "secret"
        try:
            self.assertTrue(self.registry.get("vision-api").key_ready)
        finally:
            del os.environ["TEST_API_KEY"]

    def test_missing_model_raises_not_found(self) -> None:
        with self.assertRaises(ApiError) as caught:
            self.registry.get("ghost")
        self.assertEqual(caught.exception.status, 404)

    def test_missing_models_directory_yields_empty_list(self) -> None:
        self.assertEqual(ModelRegistry(self.root / "nowhere").list(), [])


if __name__ == "__main__":
    unittest.main()
