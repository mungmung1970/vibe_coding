"""첨부 문서(xlsx / hwp / hwpx / 텍스트)를 프롬프트에 넣을 평문으로 바꾼다.

표준 라이브러리만 쓴다. xlsx·hwpx는 zip+XML이고, hwp 5.0은 OLE 복합문서라
아래에 최소 OLE(CFB) 판독기를 두었다. 서식·수식·이미지는 버리고 글자만 남긴다.
"""

from __future__ import annotations

import base64
import io
import re
import struct
import zipfile
import zlib
from xml.etree import ElementTree

from ..core.errors import ApiError

MAX_DOC_BYTES = 3 * 1024 * 1024  # 본문 4MB 제한 - base64 팽창분
MAX_DOC_CHARS = 120_000
SUPPORTED = (".xlsx", ".xlsm", ".hwp", ".hwpx", ".csv", ".txt", ".md", ".json")


def parse_data_url(name: str, data_url: str) -> bytes:
    """`data:...;base64,<...>` 한 건을 원본 바이트로 되돌린다."""
    head, _, encoded = str(data_url or "").partition(",")
    if not encoded or "base64" not in head:
        raise ApiError(422, "invalid_document", f"'{name}'은(는) base64 data URL이 아닙니다.")
    try:
        data = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError):
        raise ApiError(422, "invalid_document", f"'{name}'의 base64를 해석할 수 없습니다.") from None
    if not data:
        raise ApiError(422, "empty_document", f"'{name}'이 비어 있습니다.")
    if len(data) > MAX_DOC_BYTES:
        raise ApiError(413, "document_too_large", f"파일 하나는 {MAX_DOC_BYTES // (1024 * 1024)}MB를 넘을 수 없습니다.")
    return data


def parse_document(name: str, data: bytes) -> dict:
    """확장자에 맞는 파서를 골라 `{name, kind, text, chars, truncated}`를 준다."""
    lowered = name.lower()
    if lowered.endswith((".xlsx", ".xlsm")):
        kind, text = "xlsx", xlsx_text(data)
    elif lowered.endswith(".hwpx"):
        kind, text = "hwpx", hwpx_text(data)
    elif lowered.endswith(".hwp"):
        kind, text = "hwp", hwp_text(data)
    elif lowered.endswith((".csv", ".txt", ".md", ".json")):
        kind, text = lowered.rsplit(".", 1)[1], _decode(data)
    else:
        raise ApiError(422, "unsupported_document", f"'{name}'은(는) 지원하지 않는 형식입니다. 가능: {', '.join(SUPPORTED)}")

    text = text.strip()
    if not text:
        raise ApiError(422, "empty_document", f"'{name}'에서 읽을 텍스트를 찾지 못했습니다.")
    truncated = len(text) > MAX_DOC_CHARS
    if truncated:
        text = text[:MAX_DOC_CHARS] + f"\n…(이하 {MAX_DOC_CHARS}자에서 잘림)"
    return {"name": name, "kind": kind, "text": text, "chars": len(text), "truncated": truncated}


def _decode(data: bytes) -> str:
    """UTF-8(BOM 포함) 먼저, 안 되면 한국어 윈도 기본 인코딩."""
    for encoding in ("utf-8-sig", "cp949"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _zip(data: bytes, name: str) -> zipfile.ZipFile:
    try:
        return zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise ApiError(422, "invalid_document", f"{name} 파일이 손상되었거나 형식이 다릅니다.") from None


def _tag(element: ElementTree.Element) -> str:
    """`{namespace}local` → `local`."""
    return element.tag.rsplit("}", 1)[-1]


# ---------- xlsx ----------

_COLUMN = re.compile(r"([A-Z]+)")


def _column_index(ref: str) -> int:
    letters = _COLUMN.match(ref.upper())
    if not letters:
        return 0
    index = 0
    for char in letters.group(1):
        index = index * 26 + (ord(char) - 64)
    return index - 1


def xlsx_text(data: bytes) -> str:
    """시트마다 `## 시트명` 머리글과 탭으로 구분한 셀 값을 남긴다."""
    with _zip(data, "xlsx") as archive:
        members = set(archive.namelist())
        shared = _xlsx_shared_strings(archive) if "xl/sharedStrings.xml" in members else []
        sheets = _xlsx_sheet_names(archive)
        parts: list[str] = []
        for index, path in enumerate(sorted(name for name in members if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", name))):
            title = sheets[index] if index < len(sheets) else f"sheet{index + 1}"
            rows = _xlsx_rows(archive.read(path), shared)
            if rows:
                parts.append(f"## {title}\n" + "\n".join(rows))
    return "\n\n".join(parts)


def _xlsx_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
    return ["".join(node.text or "" for node in item.iter() if _tag(node) == "t") for item in root if _tag(item) == "si"]


def _xlsx_sheet_names(archive: zipfile.ZipFile) -> list[str]:
    try:
        root = ElementTree.fromstring(archive.read("xl/workbook.xml"))
    except KeyError:
        return []
    return [sheet.get("name", "") for sheet in root.iter() if _tag(sheet) == "sheet"]


def _xlsx_rows(sheet_xml: bytes, shared: list[str]) -> list[str]:
    rows: list[str] = []
    for row in ElementTree.fromstring(sheet_xml).iter():
        if _tag(row) != "row":
            continue
        cells: list[str] = []
        for cell in row:
            if _tag(cell) != "c":
                continue
            position = _column_index(cell.get("r", ""))
            while len(cells) < position:  # 빈 칸도 자리를 지켜 열이 밀리지 않게 한다
                cells.append("")
            cells.append(_xlsx_cell_value(cell, shared))
        line = "\t".join(cells).rstrip("\t")
        if line.strip():
            rows.append(line)
    return rows


def _xlsx_cell_value(cell: ElementTree.Element, shared: list[str]) -> str:
    kind = cell.get("t", "n")
    if kind == "inlineStr":
        return "".join(node.text or "" for node in cell.iter() if _tag(node) == "t")
    value = next((node.text or "" for node in cell if _tag(node) == "v"), "")
    if kind == "s":
        try:
            return shared[int(value)]
        except (ValueError, IndexError):
            return ""
    return value


# ---------- hwpx (한글 문서 · zip + XML) ----------


def hwpx_text(data: bytes) -> str:
    with _zip(data, "hwpx") as archive:
        sections = sorted(name for name in archive.namelist() if re.fullmatch(r"Contents/section\d+\.xml", name))
        if not sections:
            raise ApiError(422, "invalid_document", "hwpx 안에서 본문(Contents/section*.xml)을 찾지 못했습니다.")
        paragraphs: list[str] = []
        for path in sections:
            for element in ElementTree.fromstring(archive.read(path)).iter():
                if _tag(element) == "p":
                    paragraphs.append("".join(node.text or "" for node in element.iter() if _tag(node) == "t"))
    return "\n".join(paragraphs)


# ---------- hwp 5.0 (한글 문서 · OLE 복합문서) ----------

HWP_SIGNATURE = b"HWP Document File"
_PARA_TEXT_TAG = 67  # HWPTAG_BEGIN(16) + 51
_CTRL_WIDE = frozenset({1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23})  # 8 WCHAR 차지


def hwp_text(data: bytes) -> str:
    ole = OleFile(data)
    header = ole.read("FileHeader")
    if not header.startswith(HWP_SIGNATURE):
        raise ApiError(422, "invalid_document", "한글 5.0 문서가 아닙니다. hwpx로 저장한 뒤 올려 주세요.")
    flags = struct.unpack_from("<I", header, 36)[0]
    if flags & 0x2:
        raise ApiError(422, "document_encrypted", "암호가 걸린 hwp 파일은 읽을 수 없습니다.")
    compressed = bool(flags & 0x1)
    sections = sorted(
        (name for name in ole.names() if re.fullmatch(r"Section\d+", name)),
        key=lambda name: int(name[7:]),
    )
    if not sections:
        raise ApiError(422, "invalid_document", "hwp 안에서 본문(BodyText/Section*)을 찾지 못했습니다.")
    paragraphs: list[str] = []
    for name in sections:
        raw = ole.read(name)
        if compressed:
            try:
                raw = zlib.decompress(raw, -15)
            except zlib.error:
                raise ApiError(422, "invalid_document", f"{name} 본문 압축을 풀 수 없습니다.") from None
        paragraphs += _hwp_records_text(raw)
    return "\n".join(paragraphs)


def _hwp_records_text(section: bytes) -> list[str]:
    """레코드 스트림에서 PARA_TEXT 조각만 골라 문단 문자열로 만든다."""
    paragraphs: list[str] = []
    position = 0
    while position + 4 <= len(section):
        header = struct.unpack_from("<I", section, position)[0]
        tag = header & 0x3FF
        size = (header >> 20) & 0xFFF
        position += 4
        if size == 0xFFF:
            if position + 4 > len(section):
                break
            size = struct.unpack_from("<I", section, position)[0]
            position += 4
        payload = section[position : position + size]
        position += size
        if tag == _PARA_TEXT_TAG:
            paragraphs.append(_hwp_paragraph(payload))
    return paragraphs


def _hwp_paragraph(payload: bytes) -> str:
    """UTF-16LE 본문에서 제어문자를 걷어낸다(제어문자 일부는 8 WCHAR을 차지한다)."""
    out: list[str] = []
    index = 0
    while index + 2 <= len(payload):
        code = struct.unpack_from("<H", payload, index)[0]
        if code in _CTRL_WIDE:
            if code == 9:
                out.append("\t")
            index += 16
        elif code in (10, 13):
            out.append("\n")
            index += 2
        elif code < 32:
            index += 2
        else:
            out.append(chr(code))
            index += 2
    return "".join(out).strip()


class OleFile:
    """읽기 전용 최소 OLE(CFB) 판독기. 스트림 이름으로 바로 찾는다."""

    SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
    FREE_SECTOR = 0xFFFFFFFF

    def __init__(self, data: bytes) -> None:
        if not data.startswith(self.SIGNATURE):
            raise ApiError(422, "invalid_document", "OLE 복합문서(한글 5.0)가 아닙니다.")
        self.data = data
        self.sector_size = 1 << struct.unpack_from("<H", data, 30)[0]
        self.mini_sector_size = 1 << struct.unpack_from("<H", data, 32)[0]
        self.mini_cutoff = struct.unpack_from("<I", data, 56)[0]
        self._fat = self._read_fat()
        self._entries = self._read_directory(struct.unpack_from("<I", data, 48)[0])
        root = next((entry for entry in self._entries if entry["type"] == 5), None)
        if root is None:
            raise ApiError(422, "invalid_document", "OLE 루트 디렉터리를 찾을 수 없습니다.")
        self._mini_fat = self._read_mini_fat()
        self._mini_stream = self._read_chain(root["start"], root["size"], self._fat, self.sector_size)

    def names(self) -> list[str]:
        return [entry["name"] for entry in self._entries if entry["type"] == 2]

    def read(self, name: str) -> bytes:
        entry = next((item for item in self._entries if item["type"] == 2 and item["name"] == name), None)
        if entry is None:
            raise ApiError(422, "invalid_document", f"hwp 안에 '{name}' 스트림이 없습니다.")
        if entry["size"] < self.mini_cutoff:
            return self._read_mini(entry["start"], entry["size"])
        return self._read_chain(entry["start"], entry["size"], self._fat, self.sector_size)

    def _sector(self, number: int) -> bytes:
        start = 512 + number * self.sector_size
        return self.data[start : start + self.sector_size]

    def _read_fat(self) -> list[int]:
        difat = list(struct.unpack_from("<109I", self.data, 76))
        next_difat = struct.unpack_from("<I", self.data, 68)[0]
        guard = 0
        while next_difat < self.FREE_SECTOR - 1 and guard < 1000:
            block = self._sector(next_difat)
            if len(block) < self.sector_size:  # 잘린 파일
                break
            count = self.sector_size // 4 - 1
            difat += list(struct.unpack_from(f"<{count}I", block, 0))
            next_difat = struct.unpack_from("<I", block, count * 4)[0]
            guard += 1
        fat: list[int] = []
        for number in difat:
            if number >= self.FREE_SECTOR - 1:
                continue
            block = self._sector(number)
            if len(block) < self.sector_size:
                continue
            fat += list(struct.unpack_from(f"<{self.sector_size // 4}I", block, 0))
        return fat

    def _read_mini_fat(self) -> list[int]:
        start = struct.unpack_from("<I", self.data, 60)[0]
        if start >= self.FREE_SECTOR - 1:
            return []
        raw = self._read_chain(start, None, self._fat, self.sector_size)
        return list(struct.unpack_from(f"<{len(raw) // 4}I", raw, 0))

    def _read_directory(self, start: int) -> list[dict]:
        raw = self._read_chain(start, None, self._fat, self.sector_size)
        entries = []
        for offset in range(0, len(raw) - 127, 128):
            block = raw[offset : offset + 128]
            name_length = struct.unpack_from("<H", block, 64)[0]
            name = block[: max(0, name_length - 2)].decode("utf-16-le", errors="replace")
            entry_type = block[66]
            if entry_type not in (1, 2, 5):
                continue
            entries.append(
                {
                    "name": name,
                    "type": entry_type,
                    "start": struct.unpack_from("<I", block, 116)[0],
                    "size": struct.unpack_from("<Q", block, 120)[0],
                }
            )
        return entries

    def _read_chain(self, start: int, size: int | None, table: list[int], unit: int, source: bytes | None = None) -> bytes:
        chunks: list[bytes] = []
        sector = start
        seen = 0
        limit = len(table) + 1
        while sector < self.FREE_SECTOR - 1 and seen <= limit:
            if source is None:
                chunks.append(self._sector(sector))
            else:
                chunks.append(source[sector * unit : (sector + 1) * unit])
            if sector >= len(table):
                break
            sector = table[sector]
            seen += 1
        data = b"".join(chunks)
        return data[:size] if size is not None else data

    def _read_mini(self, start: int, size: int) -> bytes:
        return self._read_chain(start, size, self._mini_fat, self.mini_sector_size, self._mini_stream)
