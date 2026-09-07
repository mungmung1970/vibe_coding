import os
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from app.config import BACKEND_DIR

from .support import make_models_dir


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


class ShutdownTest(unittest.TestCase):
    """SIGTERM/Ctrl+C must stop the server instead of deadlocking it."""

    def test_sigterm_stops_the_server(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            port = free_port()
            process = subprocess.Popen(
                [sys.executable, "-m", "app.main", "--port", str(port), "--engine", "vllm",
                 "--models-dir", str(make_models_dir(root))],
                cwd=BACKEND_DIR,
                env={**os.environ, "MODEL_TEST_VAR_DIR": str(root / "var"), "PYTHONUNBUFFERED": "1"},
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            try:
                self._wait_for_health(process, port)
                process.send_signal(signal.SIGTERM)
                self.assertEqual(process.wait(timeout=15), 0)
            except subprocess.TimeoutExpired:
                process.kill()
                self.fail("서버가 SIGTERM으로 종료되지 않았습니다.")
            finally:
                if process.poll() is None:
                    process.kill()

    def _wait_for_health(self, process: subprocess.Popen, port: int) -> None:
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if process.poll() is not None:
                self.fail(f"서버가 기동 중 종료되었습니다. (exit={process.returncode})")
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/v1/health", timeout=1) as response:
                    if response.status == 200:
                        return
            except (urllib.error.URLError, TimeoutError, OSError):
                time.sleep(0.2)
        self.fail("서버가 기동되지 않았습니다.")


if __name__ == "__main__":
    unittest.main()
