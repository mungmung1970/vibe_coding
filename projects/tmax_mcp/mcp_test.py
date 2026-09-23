"""List and smoke-test tools exposed by a Streamable HTTP MCP server."""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request


def request(url, payload, session=None, timeout=30):
    data = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
    if session:
        headers["Mcp-Session-Id"] = session
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read().decode("utf-8", "replace")
            return res.status, dict(res.headers), raw
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace")


def messages(raw):
    raw = raw.strip()
    if not raw:
        return []
    if raw.startswith("{"):
        return [json.loads(raw)]
    out, event = [], []
    for line in raw.splitlines() + [""]:
        if line.startswith("data:"):
            event.append(line[5:].lstrip())
        elif not line.strip() and event:
            try:
                out.append(json.loads("\n".join(event)))
            except json.JSONDecodeError:
                pass
            event = []
    return out


def result(raw):
    items = messages(raw)
    return items[-1] if items else {"error": {"message": raw or "empty response"}}


def sample(schema, data_date):
    if not isinstance(schema, dict):
        return {}
    props = schema.get("properties", {})
    required = schema.get("required", [])
    args = {}
    for name in required:
        spec = props.get(name, {})
        if "default" in spec:
            args[name] = spec["default"]
        elif spec.get("type") == "boolean":
            args[name] = False
        elif spec.get("type") == "integer":
            args[name] = 0
        elif spec.get("type") == "number":
            args[name] = 0
        elif spec.get("type") == "array":
            args[name] = []
        elif spec.get("type") == "object":
            args[name] = {}
        else:
            args[name] = "test"
    # Common envelope fields are business-required on this server even when
    # the JSON Schema omits them from `required`.
    now = data_date + "T12:00:00+00:00"
    if "session_id" in props:
        args["session_id"] = "tmax-mcp-smoke"
    if "request_timestamp" in props:
        args["request_timestamp"] = now
    if "start_time" in props:
        args["start_time"] = data_date + "T00:00:00+00:00"
    if "end_time" in props:
        args["end_time"] = now
    if "names" in props and not args.get("names"):
        args["names"] = ["__mcp_smoke_missing__"]
    if props.get("host_id", {}).get("type") == "string":
        args["host_id"] = "1"
    if "query_type" in props:
        description = props["query_type"].get("description", "")
        args["query_type"] = "timeseries" if "timeseries" in description else "stats"
    if "resource_type" in props:
        args["resource_type"] = ["cpu"]
    if "target" in props:
        args["target"] = {"type": "host", "id": 1}
    return args


def render_markdown(report, args, tools):
    lines = [
        "# MCP 테스트 결과", "", f"- 서버: `{args.url}`", f"- 데이터 기준일: `{args.date}`",
        f"- 실행 시각(UTC): `{report['started_at']}`",
        f"- 확인된 도구 수: **{len(tools)}**", f"- 테스트 소요 시간: `{report['duration_seconds']}초`", "",
        "## 연결 및 목록 조회", "",
        f"- initialize HTTP 상태: `{report.get('initialize', {}).get('http_status')}`",
        f"- 세션 발급: `{report.get('initialize', {}).get('session_received')}`",
        f"- tools/list HTTP 상태: `{report.get('tools_list', {}).get('http_status')}`", "",
        "## 도구별 호출 결과", "", "| 도구 | HTTP | 판정 | 응답 요약 |", "|---|---:|---|---|",
    ]
    for item in tools:
        response = item.get("response", {})
        structured = response.get("result", {}).get("structuredContent", {})
        error = structured.get("error") or response.get("error")
        summary = error.get("code") + ": " + error.get("message", "") if error else ("success" if item.get("ok") else "MCP error")
        lines.append(f"| `{item['name']}` | {item['http_status']} | {'PASS' if item['ok'] else 'FAIL'} | {summary.replace('|', '\\|').replace(chr(10), ' ')} |")
    lines += ["", "## 첫 번째 request / response", "", "각 도구의 첫 호출 request와 첫 response를 저장했습니다.", ""]
    for item in tools:
        lines += [f"### {item['name']}", "", "#### Request", "", "```json", json.dumps(item["request"], ensure_ascii=False, indent=2), "```", "", "#### Response", "", "```json", json.dumps(item["first_response"], ensure_ascii=False, indent=2), "```", ""]
    lines += ["## 해석", "", f"테스트 데이터 기준일은 {args.date}입니다.", ""]
    return lines


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://54.116.208.236:8080/mcp")
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--md", default="mcp_test_result.md")
    parser.add_argument("--date", default="2026-08-26", help="Data date in YYYY-MM-DD format")
    parser.add_argument("--schema", default="", help="Print one tool input schema and exit")
    args = parser.parse_args()
    started = time.time()
    report = {"url": args.url, "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tools": []}
    session = None
    init = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "tmax-mcp-tester", "version": "1.0"}}}
    status, headers, raw = request(args.url, init, timeout=args.timeout)
    session = headers.get("Mcp-Session-Id") or headers.get("mcp-session-id")
    init_msg = result(raw)
    report["initialize"] = {"http_status": status, "session_received": bool(session), "response": init_msg}
    if status >= 400 or "error" in init_msg:
        report["error"] = "initialize failed"
    else:
        status, _, raw = request(args.url, {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}, session, args.timeout)
        listed = result(raw)
        report["tools_list"] = {"http_status": status, "response": listed}
        tools = listed.get("result", {}).get("tools", [])
        if args.schema:
            selected = next((tool for tool in tools if tool.get("name") == args.schema), None)
            print(json.dumps(selected or {"error": "tool not found"}, ensure_ascii=False, indent=2))
            return 0
        for i, tool in enumerate(tools, 3):
            name = tool.get("name", "")
            params = sample(tool.get("inputSchema", {}), args.date)
            call = {"jsonrpc": "2.0", "id": i, "method": "tools/call", "params": {"name": name, "arguments": params}}
            call_status, _, call_raw = request(args.url, call, session, args.timeout)
            response_messages = messages(call_raw)
            first_response = response_messages[0] if response_messages else result(call_raw)
            msg = response_messages[-1] if response_messages else result(call_raw)
            report["tools"].append({"name": name, "arguments": params, "request": call, "http_status": call_status, "response": msg, "first_response": first_response, "ok": call_status < 400 and "error" not in msg and not msg.get("result", {}).get("isError", False)})
    report["duration_seconds"] = round(time.time() - started, 2)
    tools = report.get("tools", [])
    lines = render_markdown(report, args, tools)
    '''
        "# MCP 테스트 결과", "", f"- 서버: `{args.url}`", f"- 실행 시각(UTC): `{report['started_at']}`",
        f"- MCP 서버: `{report.get('initialize', {}).get('response', {}).get('result', {}).get('serverInfo', {}).get('name', 'unknown')}`",
        f"- 확인된 도구 수: **{len(tools)}**", f"- 테스트 소요 시간: `{report['duration_seconds']}초`", "",
        "## 연결 및 목록 조회", "", f"- initialize HTTP 상태: `{report.get('initialize', {}).get('http_status')}`",
        f"- 세션 발급: `{report.get('initialize', {}).get('session_received')}`",
        f"- tools/list HTTP 상태: `{report.get('tools_list', {}).get('http_status')}`", "",
        "## 도구별 호출 결과", "", "| 도구 | HTTP | 판정 | 입력 | 응답 요약 |", "|---|---:|---|---|---|",
    ]
    for item in tools:
        response = item.get("response", {})
        result_data = response.get("result", {})
        structured = result_data.get("structuredContent", {})
        error = structured.get("error") or response.get("error")
        summary = error.get("code") + ": " + error.get("message", "") if error else ("success" if item.get("ok") else "MCP error")
        summary = summary.replace("|", "\\|").replace("\n", " ")
        lines.append(f"| `{item['name']}` | {item['http_status']} | {'PASS' if item['ok'] else 'FAIL'} | `{json.dumps(item['arguments'], ensure_ascii=False)}` | {summary} |")
    lines += ["", "## 해석", "", "이 테스트는 도구 스키마의 필수 입력값에 대해 안전한 샘플값을 만들어 호출하는 스모크 테스트입니다. 실제 업무 데이터나 유효한 세션 ID를 제공하지 않았으므로, 필수값·형식 검증 오류는 서버 연결 실패가 아니라 입력 검증 결과입니다.", ""]
    '''
    with open(args.md, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if "error" not in report else 1


if __name__ == "__main__":
    sys.exit(main())
