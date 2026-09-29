"""문서 파서와 응답 정규화 검증. 외부 호출은 하지 않는다."""

from __future__ import annotations

import base64
import io
import sys
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.errors import ApiError
from app.services.documents import parse_data_url, parse_document
from app.services.extract import normalize, parse_rows


def _zip(members: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, body in members.items():
            archive.writestr(name, body)
    return buffer.getvalue()


DOCX = _zip({"word/document.xml": """<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p><w:r><w:t>톨루엔</w:t></w:r><w:r><w:t> 108-88-3</w:t></w:r></w:p>
<w:p><w:r><w:t>도장 공정</w:t></w:r></w:p></w:body></w:document>"""})

PPTX = _zip({"ppt/slides/slide1.xml": """<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<a:p><a:r><a:t>BOM 요약</a:t></a:r></a:p></p:sld>"""})


class DocumentTests(unittest.TestCase):
    def test_docx_keeps_paragraph_text(self):
        parsed = parse_document("a.docx", DOCX)
        self.assertEqual(parsed["kind"], "docx")
        self.assertEqual(parsed["text"].splitlines(), ["톨루엔 108-88-3", "도장 공정"])

    def test_pptx_marks_each_slide(self):
        parsed = parse_document("a.pptx", PPTX)
        self.assertEqual(parsed["kind"], "pptx")
        self.assertIn("## 슬라이드 1", parsed["text"])
        self.assertIn("BOM 요약", parsed["text"])

    def test_unsupported_extension_is_rejected(self):
        with self.assertRaises(ApiError):
            parse_document("a.pdf", b"%PDF-")

    def test_data_url_round_trip(self):
        url = "data:application/octet-stream;base64," + base64.b64encode(b"hello").decode()
        self.assertEqual(parse_data_url("a.txt", url), b"hello")
        with self.assertRaises(ApiError):
            parse_data_url("a.txt", "not-a-data-url")


class NormalizeTests(unittest.TestCase):
    def test_keeps_valid_basic_fields(self):
        row = normalize([{
            "표준물질명": "톨루엔", "데이터유형": "물질", "CAS번호": "108-88-3",
            "지역": "대한민국", "년도": "2024년", "공정": "도장",
            "부가정보": [{"항목명": "규격", "값": "20L"}],
        }])[0]
        self.assertEqual(row["데이터유형"], "물질")
        self.assertEqual(row["CAS번호"], "108-88-3")
        self.assertEqual(row["년도"], "2024")
        self.assertEqual(row["부가정보"], [{"항목명": "규격", "값": "20L"}])

    def test_invalid_values_move_to_extras(self):
        row = normalize([{
            "표준물질명": "미지물질", "데이터유형": "원료", "CAS번호": "없음",
            "지역": "", "년도": "최근", "공정": "", "수량": 12,
        }])[0]
        self.assertEqual(row["데이터유형"], "")
        self.assertEqual(row["CAS번호"], "")
        self.assertEqual(row["년도"], "")
        extras = {item["항목명"]: item["값"] for item in row["부가정보"]}
        self.assertEqual(extras, {"추정 데이터유형": "원료", "추정 CAS번호": "없음", "추정 년도": "최근", "수량": "12"})

    def test_every_row_has_all_basic_fields(self):
        row = normalize([{"표준물질명": "물"}])[0]
        self.assertEqual(sorted(row), sorted(["표준물질명", "데이터유형", "CAS번호", "지역", "년도", "공정", "부가정보"]))


class ParseRowsTests(unittest.TestCase):
    def test_reads_fenced_json_with_prose_around_it(self):
        content = '설명입니다.\n```json\n{"rows": [{"표준물질명": "물"}]}\n```\n끝.'
        self.assertEqual(parse_rows(content), [{"표준물질명": "물"}])

    def test_rejects_output_without_rows(self):
        with self.assertRaises(ApiError):
            parse_rows('{"items": []}')
        with self.assertRaises(ApiError):
            parse_rows("JSON이 없습니다")


if __name__ == "__main__":
    unittest.main()
