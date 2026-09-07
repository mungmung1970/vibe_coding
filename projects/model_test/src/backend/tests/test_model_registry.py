import json
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

    def test_lists_models_from_metadata(self) -> None:
        ids = [model.id for model in self.registry.list()]

        self.assertEqual(ids, ["plain", "reasoner"])
        self.assertEqual(self.registry.providers(), ["Local"])
        self.assertEqual(self.registry.get("reasoner").serve_path, "acme/reasoner")

    def test_reads_huggingface_config_when_metadata_is_absent(self) -> None:
        directory = self.models_dir / "hf-only"
        directory.mkdir()
        (directory / "config.json").write_text(
            json.dumps({"architectures": ["Qwen3ForCausalLM"], "max_position_embeddings": 32768}),
            encoding="utf-8",
        )
        (directory / "model.safetensors").write_bytes(b"")

        model = self.registry.get("hf-only")
        self.assertEqual(model.serve_path, str(directory))
        self.assertEqual(model.context_length, 32768)
        self.assertIn("reasoning", model.capabilities)
        self.assertTrue(model.has_weights)

    def test_relative_path_resolves_against_the_model_directory(self) -> None:
        directory = self.models_dir / "relative"
        weights = directory / "weights"
        weights.mkdir(parents=True)
        (directory / "model.json").write_text(json.dumps({"path": "weights"}), encoding="utf-8")

        self.assertEqual(self.registry.get("relative").serve_path, str(weights))

    def test_weights_are_detected_where_path_points(self) -> None:
        # The registry entry holds only metadata; the weights live elsewhere.
        store = self.root / "store" / "big-model"
        store.mkdir(parents=True)
        directory = self.models_dir / "elsewhere"
        directory.mkdir()
        (directory / "model.json").write_text(json.dumps({"path": str(store)}), encoding="utf-8")

        self.assertFalse(self.registry.get("elsewhere").has_weights)

        (store / "model-00001-of-00002.safetensors").write_bytes(b"")
        self.assertTrue(self.registry.get("elsewhere").has_weights)

    def test_directories_without_metadata_are_ignored(self) -> None:
        (self.models_dir / "empty").mkdir()
        (self.models_dir / ".hidden").mkdir()

        self.assertNotIn("empty", [model.id for model in self.registry.list()])
        self.assertNotIn(".hidden", [model.id for model in self.registry.list()])

    def test_missing_model_raises_not_found(self) -> None:
        with self.assertRaises(ApiError) as caught:
            self.registry.get("ghost")
        self.assertEqual(caught.exception.status, 404)

    def test_missing_models_directory_yields_empty_list(self) -> None:
        self.assertEqual(ModelRegistry(self.root / "nowhere").list(), [])


if __name__ == "__main__":
    unittest.main()
