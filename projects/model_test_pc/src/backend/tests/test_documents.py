"""첨부 문서 파서: xlsx / hwpx / hwp(OLE) / 텍스트."""

import base64
import io
import struct
import unittest
import zipfile
import zlib

from app.core.errors import ApiError
from app.services.documents import parse_data_url, parse_document

SHEET_XML = """<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>
<row r="2"><c r="A2"><v>42</v></c><c r="B2" t="inlineStr"><is><t>인라인</t></is></c></row>
</sheetData></worksheet>"""

SHARED_XML = """<?xml version="1.0"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<si><t>모델</t></si><si><t>점수</t></si></sst>"""

WORKBOOK_XML = """<?xml version="1.0"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheets><sheet name="평가표" sheetId="1" r:id="rId1"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>"""

SECTION_XML = """<?xml version="1.0"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
<hp:p><hp:run><hp:t>첫째 문단</hp:t></hp:run></hp:p>
<hp:p><hp:run><hp:t>둘째 </hp:t><hp:t>문단</hp:t></hp:run></hp:p>
</hs:sec>"""


def make_xlsx() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("xl/workbook.xml", WORKBOOK_XML)
        archive.writestr("xl/sharedStrings.xml", SHARED_XML)
        archive.writestr("xl/worksheets/sheet1.xml", SHEET_XML)
    return buffer.getvalue()


def make_hwpx() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("Contents/section0.xml", SECTION_XML)
    return buffer.getvalue()


def para_text_record(text: str) -> bytes:
    payload = text.encode("utf-16-le")
    header = 67 | (1 << 10) | (len(payload) << 20)  # tag=PARA_TEXT, level=1, size
    return struct.pack("<I", header) + payload


END = 0xFFFFFFFE
FREE = 0xFFFFFFFF
FATSECT = 0xFFFFFFFD


def _dir_entry(name: str, entry_type: int, start: int, size: int) -> bytes:
    raw = name.encode("utf-16-le") + b"\0\0"
    block = bytearray(128)
    block[0 : len(raw)] = raw
    struct.pack_into("<H", block, 64, len(raw))
    block[66] = entry_type
    block[68:80] = b"\xff\xff\xff\xff" * 3  # left/right/child 없음
    struct.pack_into("<I", block, 116, start)
    struct.pack_into("<Q", block, 120, size)
    return bytes(block)


def make_hwp(paragraphs: list[str], compressed: bool = True) -> bytes:
    """FileHeader + Section0만 담은 최소 OLE(CFB) 문서. 512B 섹터 · 64B 미니섹터."""
    file_header = bytearray(256)
    file_header[0 : len(b"HWP Document File")] = b"HWP Document File"
    struct.pack_into("<I", file_header, 32, 0x05000000)  # version
    struct.pack_into("<I", file_header, 36, 1 if compressed else 0)  # bit0 = 압축

    section = b"".join(para_text_record(text) for text in paragraphs)
    if compressed:
        deflate = zlib.compressobj(9, zlib.DEFLATED, -15)
        section = deflate.compress(section) + deflate.flush()

    # 미니 스트림 = FileHeader(미니섹터 0-3) + Section0(미니섹터 4-)
    mini = bytes(file_header) + section
    mini += bytes(-len(mini) % 64)
    mini_count = len(mini) // 64
    data_sectors = -(-len(mini) // 512)

    mini_fat = [index + 1 for index in range(mini_count)]
    mini_fat[3] = END  # FileHeader 체인은 미니섹터 3에서 끝난다
    mini_fat[-1] = END
    mini_fat_bytes = b"".join(struct.pack("<I", value) for value in mini_fat).ljust(512, b"\xff")

    mini_fat_start, fat_start, dir_start = data_sectors, data_sectors + 1, data_sectors + 2
    fat = [END] * (data_sectors + 3)
    for index in range(data_sectors - 1):
        fat[index] = index + 1  # 미니 스트림 체인
    fat[fat_start] = FATSECT
    fat_bytes = b"".join(struct.pack("<I", value) for value in fat).ljust(512, b"\xff")

    directory = (
        _dir_entry("Root Entry", 5, 0, len(mini))
        + _dir_entry("FileHeader", 2, 0, 256)
        + _dir_entry("Section0", 2, 4, len(section))
        + bytes(128)
    )

    header = bytearray(512)
    header[0:8] = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
    struct.pack_into("<HHH", header, 26, 3, 0xFFFE, 9)  # major, byte order, sector shift
    struct.pack_into("<H", header, 32, 6)  # mini sector shift
    struct.pack_into("<I", header, 44, 1)  # FAT 섹터 수
    struct.pack_into("<I", header, 48, dir_start)
    struct.pack_into("<I", header, 56, 4096)  # 미니 스트림 경계
    struct.pack_into("<II", header, 60, mini_fat_start, 1)
    struct.pack_into("<II", header, 68, END, 0)  # DIFAT 없음
    struct.pack_into("<I", header, 76, fat_start)
    header[80:512] = b"\xff\xff\xff\xff" * 108

    body = mini.ljust(data_sectors * 512, b"\0") + mini_fat_bytes + fat_bytes + directory
    return bytes(header) + body


class DocumentParseTest(unittest.TestCase):
    def test_xlsx_keeps_sheet_name_columns_and_gaps(self) -> None:
        parsed = parse_document("평가.xlsx", make_xlsx())

        self.assertEqual(parsed["kind"], "xlsx")
        self.assertEqual(
            parsed["text"].splitlines(),
            ["## 평가표", "모델\t\t점수", "42\t인라인"],  # B1 빈 칸이 자리를 지킨다
        )

    def test_hwpx_joins_paragraph_runs(self) -> None:
        parsed = parse_document("보고서.hwpx", make_hwpx())

        self.assertEqual(parsed["kind"], "hwpx")
        self.assertEqual(parsed["text"].splitlines(), ["첫째 문단", "둘째 문단"])

    def test_hwp_reads_compressed_ole_body(self) -> None:
        parsed = parse_document("보고서.hwp", make_hwp(["한글 본문 첫째 줄", "둘째 줄"]))

        self.assertEqual(parsed["kind"], "hwp")
        self.assertEqual(parsed["text"].splitlines(), ["한글 본문 첫째 줄", "둘째 줄"])

    def test_hwp_reads_uncompressed_ole_body(self) -> None:
        parsed = parse_document("보고서.hwp", make_hwp(["압축 없음"], compressed=False))

        self.assertEqual(parsed["text"], "압축 없음")

    def test_hwp_rejects_non_ole_payload(self) -> None:
        with self.assertRaises(ApiError) as caught:
            parse_document("가짜.hwp", b"not an ole file")
        self.assertEqual(caught.exception.status, 422)

    def test_csv_falls_back_to_cp949(self) -> None:
        parsed = parse_document("표.csv", "모델,점수\n가,1\n".encode("cp949"))

        self.assertIn("모델,점수", parsed["text"])

    def test_rejects_unsupported_extension(self) -> None:
        with self.assertRaises(ApiError) as caught:
            parse_document("그림.png", b"\x89PNG")
        self.assertEqual(caught.exception.code, "unsupported_document")

    def test_data_url_round_trip_and_limits(self) -> None:
        encoded = base64.b64encode(b"hello").decode()

        self.assertEqual(parse_data_url("a.txt", f"data:text/plain;base64,{encoded}"), b"hello")
        with self.assertRaises(ApiError):
            parse_data_url("a.txt", "not-a-data-url")


if __name__ == "__main__":
    unittest.main()
