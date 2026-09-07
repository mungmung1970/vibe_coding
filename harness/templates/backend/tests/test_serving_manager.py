import tempfile
import time
import unittest
from dataclasses import replace
from pathlib import Path

from app.core.errors import ApiError
from app.services.engines import VllmProcessEngine, create_engine, vllm_available
from app.services.model_registry import ModelRegistry
from app.services.serving_manager import READY, ServingManager

from .support import StubEngine, make_config


class ServingManagerTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.config = make_config(Path(self._tmp.name))
        self.registry = ModelRegistry(self.config.models_dir)
        self.manager = ServingManager(self.config, self.registry, StubEngine(self.config))

    def tearDown(self) -> None:
        self.manager.shutdown()
        self._tmp.cleanup()

    def _wait_ready(self, timeout: float = 5.0) -> dict:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            status = self.manager.status()
            if status["status"] in {READY, "error"}:
                return status
            time.sleep(0.05)
        self.fail("serving did not settle in time")

    def test_serving_becomes_ready(self) -> None:
        self.assertEqual(self.manager.status()["status"], "idle")
        self.manager.serve("reasoner")

        status = self._wait_ready()
        self.assertEqual(status["status"], READY)
        self.assertEqual(status["model_id"], "reasoner")
        self.assertEqual(self.manager.active_model().id, "reasoner")

    def test_selecting_another_model_replaces_the_served_one(self) -> None:
        self.manager.serve("reasoner")
        self._wait_ready()
        self.manager.serve("plain")
        status = self._wait_ready()

        self.assertEqual(status["model_id"], "plain")
        self.assertEqual(self.manager.active_model().id, "plain")
        self.assertIn("[stub] 'plain' 서빙을 시작합니다.", "\n".join(self.manager.logs()["lines"]))

    def test_stop_returns_to_idle(self) -> None:
        self.manager.serve("reasoner")
        self._wait_ready()

        status = self.manager.stop()
        self.assertEqual(status["status"], "idle")
        self.assertIsNone(self.manager.active_model())

    def test_require_ready_rejects_other_models_and_idle_state(self) -> None:
        with self.assertRaises(ApiError) as idle:
            self.manager.require_ready()
        self.assertEqual(idle.exception.status, 409)

        self.manager.serve("reasoner")
        self._wait_ready()
        with self.assertRaises(ApiError) as mismatch:
            self.manager.require_ready("plain")
        self.assertEqual(mismatch.exception.code, "model_mismatch")

    def test_unknown_model_is_not_found(self) -> None:
        with self.assertRaises(ApiError) as caught:
            self.manager.serve("ghost")
        self.assertEqual(caught.exception.status, 404)


class VllmCommandTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.config = make_config(Path(self._tmp.name), vllm_command="vllm serve")
        self.registry = ModelRegistry(self.config.models_dir)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_side_installed_venv_is_used_and_detected(self) -> None:
        # vLLM lives in its own virtualenv so the host interpreter keeps its torch build.
        config = make_config(Path(tempfile.mkdtemp(dir=self._tmp.name)))
        with self.assertRaises(ApiError) as missing:
            create_engine(replace(config, engine="auto"))
        self.assertEqual(missing.exception.code, "vllm_missing")

        interpreter = config.vllm_venv / "bin" / "python"
        interpreter.parent.mkdir(parents=True)
        interpreter.touch()
        package = config.vllm_venv / "lib" / "python3.12" / "site-packages" / "vllm"
        package.mkdir(parents=True)
        (package / "__init__.py").touch()

        self.assertTrue(vllm_available(config))
        self.assertIsInstance(create_engine(replace(config, engine="auto")), VllmProcessEngine)
        command = VllmProcessEngine(config).build_command(ModelRegistry(config.models_dir).get("plain"))
        self.assertEqual(command[:3], [str(interpreter), "-m", "vllm.entrypoints.openai.api_server"])

    def test_command_carries_model_identity_and_engine_args(self) -> None:
        command = VllmProcessEngine(self.config).build_command(self.registry.get("reasoner"))

        self.assertEqual(command[:2], ["vllm", "serve"])
        self.assertIn("--served-model-name", command)
        self.assertEqual(command[command.index("--model") + 1], "acme/reasoner")
        self.assertEqual(command[command.index("--max-model-len") + 1], "4096")
        self.assertIn("--trust-remote-code", command)
        self.assertEqual(command[command.index("--port") + 1], str(self.config.vllm_port))


if __name__ == "__main__":
    unittest.main()
