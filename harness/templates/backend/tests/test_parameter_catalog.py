import tempfile
import unittest
from pathlib import Path

from app.config import APP_DIR
from app.core.errors import ApiError
from app.services.model_registry import Model, ModelRegistry
from app.services.parameter_catalog import ParameterCatalog

from .support import make_models_dir


class ParameterCatalogTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.registry = ModelRegistry(make_models_dir(Path(self._tmp.name)))
        self.catalog = ParameterCatalog(APP_DIR / "data" / "parameters.json")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_schema_hides_reasoning_parameters_for_plain_models(self) -> None:
        reasoning_keys = {"show_thinking", "reasoning_effort"}
        with_reasoning = self.catalog.schema_for(self.registry.get("reasoner"))
        without = self.catalog.schema_for(self.registry.get("plain"))

        self.assertTrue(reasoning_keys <= {spec["key"] for spec in with_reasoning["parameters"]})
        self.assertFalse(reasoning_keys & {spec["key"] for spec in without["parameters"]})
        self.assertNotIn("reasoning", {group["id"] for group in without["groups"]})

    def test_model_overrides_change_defaults_and_bounds(self) -> None:
        schema = self.catalog.schema_for(self.registry.get("reasoner"))
        max_tokens = next(spec for spec in schema["parameters"] if spec["key"] == "max_tokens")

        self.assertEqual(max_tokens["default"], 512)
        self.assertEqual(max_tokens["max"], 4096)
        self.assertEqual(schema["defaults"]["max_tokens"], 512)

    def test_resolve_splits_values_into_engine_buckets(self) -> None:
        model = self.registry.get("reasoner")
        resolved = self.catalog.resolve(
            model,
            {"temperature": "0.5", "top_k": 40, "reasoning_effort": "high", "show_thinking": True, "stop": "END, ###"},
        )

        self.assertEqual(resolved.body["temperature"], 0.5)
        self.assertEqual(resolved.body["stop"], ["END", "###"])
        self.assertEqual(resolved.extra_body["top_k"], 40)
        self.assertEqual(resolved.chat_template_kwargs, {"reasoning_effort": "high"})
        self.assertEqual(resolved.client["show_thinking"], True)
        self.assertNotIn("show_thinking", resolved.body)

    def test_resolve_fills_defaults_and_omits_null_seed(self) -> None:
        resolved = self.catalog.resolve(self.registry.get("plain"), {})

        self.assertEqual(resolved.values["temperature"], 0.3)
        self.assertIsNone(resolved.values["seed"])
        self.assertNotIn("seed", resolved.body)

    def test_gated_parameter_is_dropped_when_its_gate_is_off(self) -> None:
        resolved = self.catalog.resolve(self.registry.get("plain"), {"logprobs": False, "top_logprobs": 5})

        self.assertNotIn("top_logprobs", resolved.body)

    def test_out_of_range_and_unknown_values_are_rejected(self) -> None:
        model = self.registry.get("plain")
        for values in ({"temperature": 9}, {"top_p": "abc"}, {"nope": 1}, {"max_tokens": 1.5}):
            with self.subTest(values=values), self.assertRaises(ApiError) as caught:
                self.catalog.resolve(model, values)
            self.assertEqual(caught.exception.status, 422)

    def test_provider_support_hides_unsupported_parameters(self) -> None:
        # vLLM 확장 필드는 외부 API 모델에 보내면 400이 나므로 아예 노출하지 않는다.
        local = {spec["key"] for spec in self.catalog.specs_for(self.registry.get("reasoner"))}
        self.assertIn("repetition_penalty", local)

        remote = Model(id="r", name="R", provider="OpenAI", description="", directory="", serve_path="gpt",
                       provider_type="openai", capabilities=("chat",))
        keys = {spec["key"] for spec in self.catalog.specs_for(remote)}
        self.assertNotIn("repetition_penalty", keys)
        self.assertNotIn("top_k", keys)
        self.assertIn("temperature", keys)

    def test_empty_list_values_are_not_sent(self) -> None:
        resolved = self.catalog.resolve(self.registry.get("plain"), {"stop": []})

        self.assertEqual(resolved.values["stop"], [])
        self.assertNotIn("stop", resolved.body)


if __name__ == "__main__":
    unittest.main()
