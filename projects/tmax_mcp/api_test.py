"""Smoke-test every OpenAPI operation and save request/response details."""
import argparse
import json
import re
import sys
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request


def ref(spec, root):
    if isinstance(spec, dict) and "$ref" in spec:
        value = root
        for part in spec["$ref"].split("/")[1:]:
            value = value[part]
        return value
    return spec or {}


def sample(schema, root, name=""):
    schema = ref(schema, root)
    if "default" in schema:
        return schema["default"]
    if "anyOf" in schema:
        options = [x for x in schema["anyOf"] if x.get("type") != "null"]
        return sample(options[0], root, name) if options else None
    if "enum" in schema:
        return schema["enum"][0]
    fmt = schema.get("format")
    typ = schema.get("type")
    if fmt == "uuid":
        return str(uuid.uuid4())
    if fmt == "date-time":
        return "2026-08-26T12:00:00+00:00"
    if typ == "object":
        return {k: sample(v, root, k) for k, v in schema.get("properties", {}).items() if k in schema.get("required", [])}
    if typ == "array":
        return [sample(schema.get("items", {}), root, name)] if schema.get("minItems", 0) else []
    if typ == "boolean":
        return False
    if typ == "integer" or typ == "number":
        return max(1, schema.get("minimum", 1))
    return "smoke-test"


def body_for(operation, root, path=""):
    body = operation.get("requestBody", {}).get("content", {})
    if not body:
        return None, None
    content_type = next(iter(body))
    schema = body[content_type].get("schema", {})
    if content_type == "multipart/form-data":
        if path == "/api/v1/chat/image":
            return content_type, {"files": ("smoke.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDAT\x08\xd7c\xf8\xcf\xc0\xf0\x1f\x00\x05\x00\x01\xff\x89\x99=\x1d\x00\x00\x00\x00IEND\xaeB\x60\x82", "image/png")}
        return content_type, {"files": ("smoke.txt", b"smoke-test", "text/plain")}
    if path.endswith("/chat"):
        return content_type, {"message": "JEUS를 host 1에 설치해줘", "intent": "deploy"}
    if path.endswith("/hitl-resume"):
        return content_type, {"decision": "rejected"}
    if path.endswith("/hitl-cancel"):
        return content_type, {"reason": "HITL smoke test cancellation"}
    return content_type, sample(schema, root)


def call(url, method, headers=None, body=None, content_type=None, timeout=30):
    headers = {"Accept": "application/json, text/event-stream", **(headers or {})}
    data = None
    if body is not None:
        if content_type == "multipart/form-data":
            boundary = "----tmax-api-smoke"
            headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
            filename, filedata, filetype = body["files"]
            data = b"--" + boundary.encode() + b"\r\nContent-Disposition: form-data; name=\"files\"; filename=\"" + filename.encode() + b"\"\r\nContent-Type: " + filetype.encode() + b"\r\n\r\n" + filedata + b"\r\n--" + boundary.encode() + b"--\r\n"
        else:
            headers["Content-Type"] = content_type or "application/json"
            data = json.dumps(body, ensure_ascii=False).encode()
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, dict(response.headers), response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        return error.code, dict(error.headers), error.read().decode("utf-8", "replace")
    except Exception as error:
        return 0, {}, f"{type(error).__name__}: {error}"


def first_line(text):
    return text.splitlines()[0][:300] if text else ""


def json_object(text):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://10.10.20.96:17600")
    parser.add_argument("--output", default="api_test_result.md")
    parser.add_argument("--list-output", default="api_list_result.md")
    parser.add_argument("--detail-output", default="api_request_response.md")
    parser.add_argument("--document-id", default="", help="Existing document file_id from the document index")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    status, _, raw = call(base + "/openapi.json", "GET")
    if status != 200:
        raise SystemExit(f"OpenAPI 조회 실패: HTTP {status}\n{raw}")
    spec = json.loads(raw)
    session_id = None
    state = {"request_id": None, "job_id": None, "kb_id": None, "document_id": args.document_id or None, "agent_id": None}
    rows = []
    operations = [(path, method, operation, path_item) for path, path_item in spec.get("paths", {}).items() for method, operation in path_item.items() if method.lower() in {"get", "post", "put", "patch", "delete"}]
    def operation_order(item):
        path, method = item[0], item[1].lower()
        if path == "/api/v1/sessions" and method == "post":
            return 0
        if path.endswith("/hitl-status"):
            return 2
        if path.endswith("/hitl-resume"):
            return 3
        if path.endswith("/hitl-cancel"):
            return 4
        if path == "/api/v1/sessions/{session_id}" and method == "delete":
            return 9
        return 1
    operations.sort(key=operation_order)
    for path, method, operation, path_item in operations:
            method = method.upper()
            if method == "DELETE":
                continue
            path_params = {}
            for parameter in operation.get("parameters", []) + path_item.get("parameters", []):
                if parameter.get("in") == "path":
                    schema = ref(parameter.get("schema", {}), spec)
                    key = parameter["name"]
                    path_params[key] = session_id if key == "session_id" and session_id else state.get(key) or sample(schema, spec, key)
            concrete = path
            for key, value in path_params.items():
                concrete = concrete.replace("{" + key + "}", urllib.parse.quote(str(value), safe=""))
            query = {}
            for parameter in operation.get("parameters", []) + path_item.get("parameters", []):
                if parameter.get("in") == "query":
                    key = parameter["name"]
                    query[key] = state.get(key) or sample(parameter.get("schema", {}), spec, key)
            url = base + concrete + ("?" + urllib.parse.urlencode(query) if query else "")
            content_type, body = body_for(operation, spec, path)
            if path.endswith("/sessions") and method == "POST" and body is not None:
                body = {}
            headers = {"x-api-key": "smoke-test"} if "/settings/" in path or "/admin/" in path and method in {"POST", "PUT", "PATCH", "DELETE"} else {}
            req_display = {"method": method, "url": url, "headers": headers, "body": body if content_type != "multipart/form-data" else f"multipart file: {body['files'][0]}"}
            response_status, response_headers, response_body = call(url, method, headers, body, content_type)
            if path == "/api/v1/sessions" and method == "POST" and response_status in {200, 201}:
                try:
                    session_id = json.loads(response_body).get("session_id")
                except json.JSONDecodeError:
                    pass
            parsed = json_object(response_body)
            if path.endswith("/chat"):
                match = re.search(r'"agent_id"\s*:\s*"([0-9a-f-]{36})"', response_body)
                if match:
                    state["agent_id"] = match.group(1)
            if path == "/api/v1/sessions/{session_id}/chat/file" and parsed.get("request_id"):
                state["request_id"] = parsed["request_id"]
                files = parsed.get("files") or []
                if not args.document_id and files and files[0].get("file_id"):
                    state["document_id"] = files[0]["file_id"]
            if path == "/api/v1/chat/image":
                images = parsed.get("images") or []
                if images and images[0].get("job_id"):
                    state["job_id"] = images[0]["job_id"]
            if path == "/api/v1/kb" and parsed.get("kb_list"):
                state["kb_id"] = parsed["kb_list"][0].get("kb_id")
            if path == "/api/v1/ingest" and parsed.get("files"):
                state["file_id"] = parsed["files"][0].get("file_id")
            rows.append({"method": method, "path": path, "summary": operation.get("summary", ""), "request": req_display, "http_status": response_status, "response_headers": response_headers, "response": response_body, "success": 200 <= response_status < 400})
    with open(args.output, "w", encoding="utf-8") as output:
        output.write(f"# API 전체 테스트 결과\n\n- Base URL: `{base}`\n- OpenAPI 경로/메서드 수: **{len(rows)}**\n- 실행 시각(UTC): `{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}`\n\n")
        output.write("| Method | Path | HTTP | Success | Response 요약 |\n|---|---|---:|---|---|\n")
        for row in rows:
            summary = first_line(row["response"]).replace("|", "\\|")
            output.write(f"| `{row['method']}` | `{row['path']}` | {row['http_status']} | {'PASS' if row['success'] else 'FAIL'} | {summary} |\n")
        output.write("\n## Request / Response 원문\n")
        for index, row in enumerate(rows, 1):
            output.write(f"\n### {index}. {row['method']} {row['path']}\n\n#### Request\n\n```json\n{json.dumps(row['request'], ensure_ascii=False, indent=2)}\n```\n\n#### Response (HTTP {row['http_status']})\n\n```text\n{row['response']}\n```\n")
    with open(args.list_output, "w", encoding="utf-8") as output:
        output.write(f"# API 목록 및 테스트 결과\n\n- Base URL: `{base}`\n- 테스트 API 수: **{len(rows)}**\n- 성공: **{sum(row['success'] for row in rows)}**\n- 실패: **{sum(not row['success'] for row in rows)}**\n- 삭제 메서드: 테스트 제외\n\n")
        output.write("| 번호 | Method | API | HTTP | 성공여부 | 실패/응답 요약 |\n|---:|---|---|---:|---|---|\n")
        for index, row in enumerate(rows, 1):
            summary = first_line(row["response"]).replace("|", "\\|")
            output.write(f"| {index} | `{row['method']}` | `{row['path']}` | {row['http_status']} | {'성공' if row['success'] else '실패'} | {summary} |\n")
    with open(args.detail_output, "w", encoding="utf-8") as output:
        output.write(f"# API별 Request / Response\n\n- Base URL: `{base}`\n- 테스트 API 수: **{len(rows)}**\n- 삭제 메서드: 테스트 제외\n\n")
        for index, row in enumerate(rows, 1):
            output.write(f"## {index}. {row['method']} {row['path']}\n\n- HTTP: `{row['http_status']}`\n- 성공여부: **{'성공' if row['success'] else '실패'}**\n\n### Request\n\n```json\n{json.dumps(row['request'], ensure_ascii=False, indent=2)}\n```\n\n### Response\n\n```text\n{row['response']}\n```\n\n")
    print(json.dumps({"count": len(rows), "pass": sum(row["success"] for row in rows), "fail": sum(not row["success"] for row in rows), "list_output": args.list_output, "detail_output": args.detail_output}, ensure_ascii=False))


if __name__ == "__main__":
    main()
