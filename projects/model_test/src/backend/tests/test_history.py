import tempfile
import unittest
from pathlib import Path

from app.core.errors import ApiError
from app.services.history import HistoryStore


def run(run_id: str, **overrides) -> dict:
    base = {
        "id": run_id,
        "created_at": "2026-07-15T10:56:00+00:00",
        "model_id": "reasoner",
        "provider": "Local",
        "prompt": "LCA 리포트는 무엇인가요?",
        "text": "LCA 리포트는 생애주기 평가 결과를 정리한 보고서입니다.",
        "parameters": {"temperature": 0.3, "top_p": 1},
        "latency_ms": 900,
    }
    return {**base, **overrides}


class HistoryStoreTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.store = HistoryStore(Path(self._tmp.name) / "var" / "history.jsonl", limit=5)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_lists_newest_first_with_previews(self) -> None:
        self.store.append(run("a"))
        self.store.append(run("b"))

        listed = self.store.list()
        self.assertEqual([item["id"] for item in listed], ["b", "a"])
        self.assertIn("생애주기", listed[0]["preview"])
        self.assertNotIn("text", listed[0])

    def test_filters_by_model_query_and_date(self) -> None:
        self.store.append(run("a"))
        self.store.append(run("b", model_id="plain", created_at="2026-07-20T09:00:00+00:00", prompt="탄소 배출량"))

        self.assertEqual([item["id"] for item in self.store.list(model_id="plain")], ["b"])
        self.assertEqual([item["id"] for item in self.store.list(query="탄소")], ["b"])
        self.assertEqual([item["id"] for item in self.store.list(date_from="2026-07-18")], ["b"])
        self.assertEqual([item["id"] for item in self.store.list(date_to="2026-07-16")], ["a"])

    def test_get_and_delete(self) -> None:
        self.store.append(run("a"))
        self.assertEqual(self.store.get("a")["text"], run("a")["text"])

        self.store.delete("a")
        with self.assertRaises(ApiError):
            self.store.get("a")
        with self.assertRaises(ApiError):
            self.store.delete("a")

    def test_trims_to_the_configured_limit(self) -> None:
        for index in range(8):
            self.store.append(run(f"r{index}"))

        listed = self.store.list(limit=100)
        self.assertEqual(len(listed), 5)
        self.assertEqual(listed[0]["id"], "r7")

    def test_compare_reports_only_differing_parameters(self) -> None:
        self.store.append(run("a"))
        self.store.append(run("b", parameters={"temperature": 0.9, "top_p": 1}))

        result = self.store.compare(["a", "b"])
        self.assertTrue(result["same_model"])
        self.assertEqual([item["key"] for item in result["parameter_differences"]], ["temperature"])
        self.assertEqual(result["parameter_differences"][0]["values"], [0.3, 0.9])

        with self.assertRaises(ApiError):
            self.store.compare(["a"])

    def test_malformed_lines_are_skipped(self) -> None:
        self.store.append(run("a"))
        with self.store.path.open("a", encoding="utf-8") as handle:
            handle.write("{not json}\n\n")

        self.assertEqual([item["id"] for item in self.store.list()], ["a"])


if __name__ == "__main__":
    unittest.main()
