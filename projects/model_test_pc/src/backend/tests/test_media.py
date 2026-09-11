"""음성·영상 호출: multipart 전사, 오디오 저장, 영상 작업 폴링."""

import base64
import json
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from app.core.errors import ApiError
from app.services import media as media_module
from app.services.media import MediaService, MediaStore
from app.services.model_registry import ModelRegistry
from app.services.parameter_catalog import ParameterCatalog

from .support import make_config

MEDIA_MODELS = {
    "fake-stt": {"modality": "STT", "parameter_profile": "stt", "capabilities": ["transcribe"]},
    "fake-tts": {"modality": "TTS", "parameter_profile": "tts", "capabilities": ["speak"]},
    "fake-video": {"modality": "VIDEO", "parameter_profile": "video", "capabilities": ["video"]},
}


class FakeMediaServer:
    """OpenAI 음성·영상 엔드포인트를 흉내내는 로컬 서버."""

    def __init__(self) -> None:
        self.requests: list[dict] = []
        self.video_polls = 0
        outer = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *_args):
                pass

            def _send(self, payload: bytes, content_type: str = "application/json") -> None:
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def do_POST(self):  # noqa: N802
                body = self.rfile.read(int(self.headers.get("Content-Length", "0")) or 0)
                outer.requests.append({"path": self.path, "body": body, "type": self.headers.get("Content-Type", "")})
                if self.path.endswith("/audio/transcriptions"):
                    self._send(json.dumps({"text": "전사된 문장"}, ensure_ascii=False).encode())
                elif self.path.endswith("/audio/speech"):
                    self._send(b"ID3fake-audio-bytes", "audio/mpeg")
                elif self.path.endswith("/videos"):
                    self._send(json.dumps({"id": "vid_1", "status": "queued", "progress": 0}).encode())
                else:
                    self._send(b"{}")

            def do_GET(self):  # noqa: N802
                outer.requests.append({"path": self.path, "body": b"", "type": ""})
                if self.path.endswith("/videos/vid_1/content"):
                    self._send(b"\x00\x00\x00\x18ftypmp42", "video/mp4")
                    return
                outer.video_polls += 1
                status = "completed" if outer.video_polls >= 2 else "in_progress"
                self._send(json.dumps({"id": "vid_1", "status": status, "progress": 50}).encode())

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.server.server_address[1]}/v1"

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)


def audio_data_url() -> str:
    return "data:audio/mpeg;base64," + base64.b64encode(b"fake-mp3-input").decode()


class MediaServiceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory()
        cls.fake = FakeMediaServer()
        root = Path(cls._tmp.name)
        cls.config = make_config(root)
        for model_id, extra in MEDIA_MODELS.items():
            directory = cls.config.models_dir / model_id
            directory.mkdir(parents=True, exist_ok=True)
            meta = {
                "id": model_id, "name": model_id, "provider": "Fake", "provider_type": "openai",
                "base_url": cls.fake.base_url, "remote_model": model_id, **extra,
            }
            (directory / "model.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
        cls.service = MediaService(
            cls.config,
            ModelRegistry(cls.config.models_dir),
            ParameterCatalog(cls.config.parameters_file),
            MediaStore(cls.config.media_dir, limit=5),
        )
        cls._poll = media_module.VIDEO_POLL_SECONDS
        media_module.VIDEO_POLL_SECONDS = 0.01  # 테스트에서 5초씩 기다릴 이유가 없다

    @classmethod
    def tearDownClass(cls) -> None:
        media_module.VIDEO_POLL_SECONDS = cls._poll
        cls.fake.close()
        cls._tmp.cleanup()

    def test_transcribe_uploads_multipart_and_returns_text(self) -> None:
        run = self.service.transcribe({
            "model_id": "fake-stt",
            "file": {"name": "회의.mp3", "data_url": audio_data_url()},
            "parameters": {"language": "ko"},
        })

        self.assertEqual(run["text"], "전사된 문장")
        sent = self.fake.requests[-1]
        self.assertTrue(sent["type"].startswith("multipart/form-data; boundary="))
        self.assertIn('filename="회의.mp3"'.encode("utf-8"), sent["body"])
        self.assertIn(b"fake-mp3-input", sent["body"])
        self.assertIn(b'name="language"', sent["body"])

    def test_speak_saves_audio_and_returns_url(self) -> None:
        run = self.service.speak({
            "model_id": "fake-tts", "prompt": "안녕하세요", "parameters": {"voice": "nova", "audio_format": "mp3"},
        })

        self.assertEqual(run["media"]["mime"], "audio/mpeg")
        media_id = run["media"]["url"].rsplit("/", 1)[1]
        self.assertEqual(self.service.store.path(media_id).read_bytes(), b"ID3fake-audio-bytes")
        self.assertEqual(json.loads(self.fake.requests[-1]["body"])["voice"], "nova")

    def test_video_polls_until_complete(self) -> None:
        events = list(self.service.video({
            "model_id": "fake-video", "prompt": "파도치는 해변", "parameters": {"seconds": "4"},
        }))

        kinds = [event["type"] for event in events]
        self.assertEqual(kinds[0], "start")
        self.assertEqual(kinds[-1], "done")
        self.assertIn("status", kinds)
        media = events[-1]["run"]["media"]
        self.assertEqual(media["mime"], "video/mp4")
        self.assertTrue(self.service.store.path(media["url"].rsplit("/", 1)[1]).is_file())

    def test_rejects_wrong_modality_and_missing_audio(self) -> None:
        with self.assertRaises(ApiError) as caught:
            self.service.speak({"model_id": "fake-stt", "prompt": "안녕"})
        self.assertEqual(caught.exception.code, "modality_mismatch")

        with self.assertRaises(ApiError) as caught:
            self.service.transcribe({"model_id": "fake-stt"})
        self.assertEqual(caught.exception.code, "audio_required")

    def test_store_keeps_only_the_newest_files(self) -> None:
        store = MediaStore(Path(self._tmp.name) / "var" / "trim", limit=3)
        ids = [store.save(b"x" * (index + 1), ".mp3") for index in range(5)]

        self.assertEqual(len(list(store.directory.iterdir())), 3)
        with self.assertRaises(ApiError):
            store.path(ids[0])


if __name__ == "__main__":
    unittest.main()
