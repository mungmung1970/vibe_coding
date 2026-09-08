import os
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from app.core.errors import ApiError
from app.services.model_registry import ModelRegistry
from app.services.providers import create_provider

from .support import FakeProviderServer, make_config


class ProviderTest(unittest.TestCase):
    """공급자 어댑터를 HTTP 경계 그대로 확인한다(외부 호출 없음)."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.fake = FakeProviderServer()
        self.config = make_config(Path(self._tmp.name))
        self.registry = ModelRegistry(self.config.models_dir)
        os.environ["TEST_API_KEY"] = "test-key"

    def tearDown(self) -> None:
        self.fake.close()
        self._tmp.cleanup()
        os.environ.pop("TEST_API_KEY", None)

    def _model(self, model_id: str, **overrides):
        return replace(self.registry.get(model_id), base_url=self.fake.base_url, **overrides)

    def _collect(self, model, payload):
        return list(create_provider(self.config, model).chat_stream(payload))

    def test_openai_compatible_call_carries_model_and_messages(self) -> None:
        model = self._model("endpoint-llm")
        chunks = self._collect(model, {
            "messages": [{"role": "user", "content": "안녕"}],
            "temperature": 0.5, "max_tokens": 100, "top_k": 40,
            "chat_template_kwargs": {"reasoning_effort": "high"},
        })

        sent = self.fake.requests[-1]
        self.assertTrue(sent["path"].endswith("/chat/completions"))
        self.assertEqual(sent["body"]["model"], "endpoint-llm")
        self.assertEqual(sent["body"]["temperature"], 0.5)
        self.assertEqual(sent["body"]["max_tokens"], 100)
        self.assertEqual(sent["body"]["reasoning_effort"], "high")
        self.assertTrue(sent["body"]["stream"])
        self.assertEqual(len(chunks), 4)

    def test_api_key_is_sent_and_max_tokens_is_renamed(self) -> None:
        self._collect(self._model("vision-api"), {
            "messages": [{"role": "user", "content": "안녕"}], "max_tokens": 100, "stop": ["END"],
        })

        sent = self.fake.requests[-1]
        self.assertEqual(sent["headers"]["authorization"], "Bearer test-key")
        # 최신 OpenAI 모델은 max_completion_tokens를 받고 stop을 거부한다.
        self.assertEqual(sent["body"]["max_completion_tokens"], 100)
        self.assertNotIn("max_tokens", sent["body"])
        self.assertNotIn("stop", sent["body"])

    def test_missing_key_is_reported_before_calling(self) -> None:
        del os.environ["TEST_API_KEY"]

        with self.assertRaises(ApiError) as caught:
            self._collect(self._model("vision-api"), {"messages": [{"role": "user", "content": "안녕"}]})
        self.assertEqual(caught.exception.code, "api_key_missing")
        self.assertEqual(self.fake.requests, [])

    def test_anthropic_request_and_stream_are_translated(self) -> None:
        model = self._model("vision-api", provider_type="anthropic", api_key_env="TEST_API_KEY",
                            unsupported_fields=())
        chunks = self._collect(model, {
            "messages": [{"role": "system", "content": "너는 비서다"}, {"role": "user", "content": "안녕"}],
            "max_tokens": 128, "stop": ["END"],
        })

        sent = self.fake.requests[-1]
        self.assertTrue(sent["path"].endswith("/messages"))
        self.assertEqual(sent["headers"]["x-api-key"], "test-key")
        self.assertEqual(sent["body"]["system"], "너는 비서다")
        self.assertEqual(sent["body"]["stop_sequences"], ["END"])
        self.assertEqual([message["role"] for message in sent["body"]["messages"]], ["user"])

        texts = [chunk["choices"][0]["delta"].get("content", "") for chunk in chunks]
        self.assertIn("안녕하세요", texts)
        self.assertEqual(chunks[-1]["usage"]["total_tokens"], 12)

    def test_images_are_converted_for_anthropic(self) -> None:
        model = self._model("vision-api", provider_type="anthropic", api_key_env="TEST_API_KEY")
        self._collect(model, {
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": "이 그림은?"},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAA"}},
            ]}],
            "max_tokens": 64,
        })

        blocks = self.fake.requests[-1]["body"]["messages"][0]["content"]
        self.assertEqual(blocks[0], {"type": "text", "text": "이 그림은?"})
        self.assertEqual(blocks[1]["source"], {"type": "base64", "media_type": "image/png", "data": "AAAA"})

    def test_provider_errors_become_readable_api_errors(self) -> None:
        self.fake.status = 400

        with self.assertRaises(ApiError) as caught:
            self._collect(self._model("endpoint-llm"), {"messages": [{"role": "user", "content": "안녕"}]})
        self.assertEqual((caught.exception.status, caught.exception.code), (502, "provider_error"))

    def test_unreachable_endpoint_names_the_address(self) -> None:
        model = replace(self.registry.get("endpoint-llm"), base_url="http://127.0.0.1:9/v1")

        with self.assertRaises(ApiError) as caught:
            self._collect(model, {"messages": [{"role": "user", "content": "안녕"}]})
        self.assertEqual(caught.exception.code, "provider_unreachable")
        self.assertIn("127.0.0.1:9", caught.exception.message)


if __name__ == "__main__":
    unittest.main()
