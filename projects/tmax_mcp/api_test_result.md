# API 전체 테스트 결과

- Base URL: `http://10.10.20.96:17600`
- OpenAPI 경로/메서드 수: **28**
- 실행 시각(UTC): `2026-09-18T05:52:47Z`

| Method | Path | HTTP | Success | Response 요약 |
|---|---|---:|---|---|
| `POST` | `/api/v1/sessions` | 201 | PASS | {"session_id":"6ea698aa-cc68-480a-8fac-bd67c87d52a6","status":"draft","created_at":"2026-09-18T05:52:44.773286Z"} |
| `POST` | `/api/v1/sessions/{session_id}/chat` | 200 | PASS | event: workflow_start |
| `POST` | `/api/v1/sessions/{session_id}/chat/file` | 200 | PASS | {"request_id":"1ee128e7-91cf-4adc-9630-2f561b4f5c7f","status":"ready","message":"문서 처리가 시작되었습니다 (1개 파일, Session: 6ea698aa-cc68-480a-8fac-bd67c87d52a6). 상태는 /pipeline/upload/1ee128e7-91cf-4adc-9630-2f561b4f5c7f/status 에서 확인할 수 있습니다.","files":[{"file_id":"a7b1a924-4522-4c2a-bf78-2358761288c1","filenam |
| `GET` | `/api/v1/sessions/{session_id}/chat/file/{request_id}/status` | 202 | PASS | {"request_id":"1ee128e7-91cf-4adc-9630-2f561b4f5c7f","status":"pending","files":null,"progress":{"done":0,"total":1},"queue":{"ahead":0,"other_work_running":false,"other_work_pending":0},"message":"첨부 문서 준비 중 (1개 중 0개 완료)"} |
| `POST` | `/api/v1/chat/image` | 200 | PASS | {"images":[{"job_id":"d1adac14-c537-4f97-b9d6-81efe735b172","file_id":"50c58bf81e0b461e95fce3f67c5a74df","file_name":"smoke.png","url":"http://10.10.20.96:17614/kbqna-qan-files-g06aiops/chat-images/20260918/50c58bf81e0b461e95fce3f67c5a74df.png","content_type":"image/png","size":70,"status":"parsing" |
| `GET` | `/api/v1/chat/image/{job_id}/status` | 200 | PASS | {"job_id":"d1adac14-c537-4f97-b9d6-81efe735b172","status":"parsing","url":"http://10.10.20.96:17614/kbqna-qan-files-g06aiops/chat-images/20260918/50c58bf81e0b461e95fce3f67c5a74df.png","image_context":null,"block_text":null,"metadata":null,"md_url":null,"parse_error":null} |
| `GET` | `/api/v1/sessions/{session_id}/agents/{agent_id}/stream` | 200 | PASS | event: workflow_start |
| `GET` | `/api/v1/sessions` | 200 | PASS | {"sessions":[{"session_id":"6ea698aa-cc68-480a-8fac-bd67c87d52a6","title":"2026-09-18 05:52 대화","message_count":2,"status":"active","created_at":"2026-09-18T05:52:44.875342Z","updated_at":"2026-09-18T05:52:45.974576Z","last_activity_at":"2026-09-18T05:52:45.945359Z"},{"session_id":"fe4f77ac-e161-413 |
| `GET` | `/api/v1/sessions/{session_id}` | 200 | PASS | {"session_id":"6ea698aa-cc68-480a-8fac-bd67c87d52a6","title":null,"status":"active","message_count":2,"created_at":"2026-09-18T05:52:44.875342Z","updated_at":"2026-09-18T05:52:45.974576Z"} |
| `PATCH` | `/api/v1/sessions/{session_id}` | 200 | PASS | {"session_id":"6ea698aa-cc68-480a-8fac-bd67c87d52a6","title":"smoke-test","status":"active","message_count":2,"created_at":"2026-09-18T05:52:44.875342Z","updated_at":"2026-09-18T05:52:46.405070Z"} |
| `GET` | `/api/v1/sessions/{session_id}/active-run` | 200 | PASS | {"run_id":null} |
| `GET` | `/api/v1/sessions/{session_id}/messages` | 200 | PASS | {"session_id":"6ea698aa-cc68-480a-8fac-bd67c87d52a6","messages":[],"prev_cursor":null,"next_cursor":null,"has_more_before":false,"has_more_after":false} |
| `GET` | `/api/v1/kb` | 200 | PASS | {"kb_list":[{"kb_id":"aa340ad9-8d8e-4649-a079-53adcf6ab897","kb_name":"WebtoB 6.1"},{"kb_id":"2205510d-a359-4c59-a917-e8d4401ee9bc","kb_name":"Tmax 6Fix1"},{"kb_id":"87d4507a-89e1-4bbf-889b-51dc92518e42","kb_name":"ProObject 7Fix1"},{"kb_id":"e8ad9d97-33a4-46f1-8ac0-9bd17df1b6d7","kb_name":"ProFrame |
| `GET` | `/api/v1/documents/{document_id}/content` | 404 | FAIL | {"type":"https://aiops-agent/errors/not-found","title":"Not Found","status":404,"detail":"문서를 찾을 수 없습니다: b738dc4a-6ed1-40df-bf50-d2cc3fd87be3","instance":"http://10.10.20.96:17600/api/v1/documents/b738dc4a-6ed1-40df-bf50-d2cc3fd87be3/content?filename=smoke-test","trace_id":"663c41d3-4ab3-4136-aa54-2 |
| `GET` | `/api/v1/documents/{document_id}/preview-url` | 200 | PASS | {"document_id":"b738dc4a-6ed1-40df-bf50-d2cc3fd87be3","download_url":"/api/be/documents/b738dc4a-6ed1-40df-bf50-d2cc3fd87be3/content","title":null} |
| `POST` | `/api/v1/sessions/{session_id}/documents` | 202 | PASS | {"job_id":"217b4a4d-c84b-4a78-b0ac-40289bc5a6e4","message_id":"1204f5e3-3b9b-43c8-b696-e4e6ddff0d13","scope":"last_answer","status":"accepted"} |
| `GET` | `/api/v1/artifacts/{artifact_id}/download` | 404 | FAIL | {"type":"https://aiops-agent/errors/not-found","title":"Not Found","status":404,"detail":"kbqna-back: {\"error_code\":\"ARTIFACT_001\",\"message\":\"산출물을 찾을 수 없습니다: smoke-test\",\"details\":{}}","instance":"http://10.10.20.96:17600/api/v1/artifacts/smoke-test/download","trace_id":"4efa9af5-d22b-4441 |
| `POST` | `/api/v1/ingest` | 200 | PASS | {"request_id":"7f1bc133-c644-4794-9ae8-e82552642c55","status":"duplicate","message":"모든 파일이 이미 KB에 존재합니다 (1개 중복, KB: aa340ad9-8d8e-4649-a079-53adcf6ab897). 임베딩 생성을 건너뜁니다.","files":[{"file_id":"976971ec-1ad1-4e46-8346-56cb11e670d2","filename":"smoke.txt","is_duplicate":true}]} |
| `GET` | `/api/v1/ingest/status` | 200 | PASS | {"kb_id":"aa340ad9-8d8e-4649-a079-53adcf6ab897","kb_name":"WebtoB 6.1","total":4,"stages":{"parsing":{"completed":0,"in_progress":0,"failed":0,"pending":4},"chunking":{"completed":0,"in_progress":0,"failed":0,"pending":4},"embedding":{"completed":0,"in_progress":0,"failed":0,"pending":4}},"all_compl |
| `POST` | `/api/v1/ingest/cancel` | 404 | FAIL | {"type":"https://aiops-agent/errors/not-found","title":"Not Found","status":404,"detail":"kbqna-back: {\"error_code\":\"DOCUMENT_001\",\"message\":\"Document with ID '976971ec-1ad1-4e46-8346-56cb11e670d2' not found\",\"details\":{\"file_id\":\"976971ec-1ad1-4e46-8346-56cb11e670d2\"}}","instance":"ht |
| `GET` | `/api/v1/settings/suggested-questions` | 200 | PASS | {"enabled":true,"max":3,"source":"override"} |
| `PUT` | `/api/v1/settings/suggested-questions` | 401 | FAIL | {"detail":"invalid api key"} |
| `GET` | `/health` | 200 | PASS | {"status":"ok","service":"aiops-agent","version":"0.1.3"} |
| `GET` | `/healthz` | 200 | PASS | {"status":"ready","checks":{"llm":"ok","mcp":"ok"},"mcp":{"servers":[{"id":"tem","connected":true,"required":false,"tool_count":9,"serving_as_fallback":0},{"id":"mock","connected":true,"required":false,"tool_count":5,"serving_as_fallback":5}],"unavailable_count":0}} |
| `GET` | `/readyz` | 200 | PASS | {"status":"ready","registered":{"shared":["C1_MCPResponseCache","C2_RAGResultCache","C3_SessionTargetCache","E1_MCPRetryHandler","E2_LLMFallbackHandler","E3_CircuitBreaker","KbqnaClient","L1_ExecutionLogger","L2_AuditLogger","L3_ErrorLogger","V1_StateValidator","V2_InputFormatValidator"],"dedicated" |
| `GET` | `/api/v1/sessions/{session_id}/agents/{agent_id}/hitl-status` | 200 | PASS | {"agent_id":"98860375-ac9d-42a5-a234-908b51f9d943","intent":"deploy","status":"completed","current_node":"UnimplementedNoticeNode","session_id":"6ea698aa-cc68-480a-8fac-bd67c87d52a6"} |
| `POST` | `/api/v1/sessions/{session_id}/agents/{agent_id}/hitl-resume` | 409 | FAIL | {"type":"https://aiops-agent/errors/conflict","title":"Conflict","status":409,"detail":"agent 98860375-ac9d-42a5-a234-908b51f9d943 is not paused (status=completed)","instance":"http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/agents/98860375-ac9d-42a5-a234-908b51f9d943/h |
| `POST` | `/api/v1/sessions/{session_id}/agents/{agent_id}/hitl-cancel` | 409 | FAIL | {"type":"https://aiops-agent/errors/conflict","title":"Conflict","status":409,"detail":"agent 98860375-ac9d-42a5-a234-908b51f9d943 already terminal (status=completed)","instance":"http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/agents/98860375-ac9d-42a5-a234-908b51f9d94 |

## Request / Response 원문

### 1. POST /api/v1/sessions

#### Request

```json
{
  "method": "POST",
  "url": "http://10.10.20.96:17600/api/v1/sessions",
  "headers": {},
  "body": {}
}
```

#### Response (HTTP 201)

```text
{"session_id":"6ea698aa-cc68-480a-8fac-bd67c87d52a6","status":"draft","created_at":"2026-09-18T05:52:44.773286Z"}
```

### 2. POST /api/v1/sessions/{session_id}/chat

#### Request

```json
{
  "method": "POST",
  "url": "http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/chat",
  "headers": {},
  "body": {
    "message": "JEUS를 host 1에 설치해줘",
    "intent": "deploy"
  }
}
```

#### Response (HTTP 200)

```text
event: workflow_start
data: {"agent_id":"98860375-ac9d-42a5-a234-908b51f9d943","intent":"deploy","session_id":"6ea698aa-cc68-480a-8fac-bd67c87d52a6","trace_id":"a8548b406dab7dde1195c01750582efe","trace_url":"http://10.10.20.96:17606/project/cmq93ei4s0006jecvxad2uvv3/traces/a8548b406dab7dde1195c01750582efe","subintent":"deploy.install","subintent_source":"gate_llm"}

event: node_progress
data: {"node":"UnimplementedNoticeNode","cycle":0,"label":null}

event: token
data: {"delta":"아직 기능(M9 커맨드 전달)이 구현되지 않아 처리할 수 없습니다.\n(설치 작업을 TEM 에 전달하는 커맨드 전달 도구가 현재 개발 범위에서 제외돼 있습니다. 설치를 대신 수행하지는 못하지만 설치 절차와 과거 같은 작업의 결과는 설치 절차 조회, 배포·패치 이력 조회로 확인하실 수 있습니다. M9는 현재 개발 범위에서 제외된 항목입니다)"}

event: workflow_end
data: {"agent_id":"98860375-ac9d-42a5-a234-908b51f9d943","status":"completed","answer":"아직 기능(M9 커맨드 전달)이 구현되지 않아 처리할 수 없습니다.\n(설치 작업을 TEM 에 전달하는 커맨드 전달 도구가 현재 개발 범위에서 제외돼 있습니다. 설치를 대신 수행하지는 못하지만 설치 절차와 과거 같은 작업의 결과는 설치 절차 조회, 배포·패치 이력 조회로 확인하실 수 있습니다. M9는 현재 개발 범위에서 제외된 항목입니다)","subintent":"deploy.install","elapsed_seconds":0.0,"mcp_docs":false,"output_guardrail":{"redaction":{"applied":false,"hits":0,"kinds":[]},"latency_ms":0},"degraded":true,"degrade_mode":"blocked","unavailable_tools":[{"tool":"M9","name":"커맨드 전달","status":"scope_excluded","role":"required"}],"unanswered_scope":[],"intent":"deploy","builder":"workflows:deploy","subintent_source":"gate_llm","mcp_tools_used":[]}


```

### 3. POST /api/v1/sessions/{session_id}/chat/file

#### Request

```json
{
  "method": "POST",
  "url": "http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/chat/file",
  "headers": {},
  "body": "multipart file: smoke.txt"
}
```

#### Response (HTTP 200)

```text
{"request_id":"1ee128e7-91cf-4adc-9630-2f561b4f5c7f","status":"ready","message":"문서 처리가 시작되었습니다 (1개 파일, Session: 6ea698aa-cc68-480a-8fac-bd67c87d52a6). 상태는 /pipeline/upload/1ee128e7-91cf-4adc-9630-2f561b4f5c7f/status 에서 확인할 수 있습니다.","files":[{"file_id":"a7b1a924-4522-4c2a-bf78-2358761288c1","filename":"smoke.txt","is_duplicate":false}]}
```

### 4. GET /api/v1/sessions/{session_id}/chat/file/{request_id}/status

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/chat/file/1ee128e7-91cf-4adc-9630-2f561b4f5c7f/status",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 202)

```text
{"request_id":"1ee128e7-91cf-4adc-9630-2f561b4f5c7f","status":"pending","files":null,"progress":{"done":0,"total":1},"queue":{"ahead":0,"other_work_running":false,"other_work_pending":0},"message":"첨부 문서 준비 중 (1개 중 0개 완료)"}
```

### 5. POST /api/v1/chat/image

#### Request

```json
{
  "method": "POST",
  "url": "http://10.10.20.96:17600/api/v1/chat/image",
  "headers": {},
  "body": "multipart file: smoke.png"
}
```

#### Response (HTTP 200)

```text
{"images":[{"job_id":"d1adac14-c537-4f97-b9d6-81efe735b172","file_id":"50c58bf81e0b461e95fce3f67c5a74df","file_name":"smoke.png","url":"http://10.10.20.96:17614/kbqna-qan-files-g06aiops/chat-images/20260918/50c58bf81e0b461e95fce3f67c5a74df.png","content_type":"image/png","size":70,"status":"parsing","metadata":null,"block_text":"","parse_error":null}],"image_context":""}
```

### 6. GET /api/v1/chat/image/{job_id}/status

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/api/v1/chat/image/d1adac14-c537-4f97-b9d6-81efe735b172/status",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 200)

```text
{"job_id":"d1adac14-c537-4f97-b9d6-81efe735b172","status":"parsing","url":"http://10.10.20.96:17614/kbqna-qan-files-g06aiops/chat-images/20260918/50c58bf81e0b461e95fce3f67c5a74df.png","image_context":null,"block_text":null,"metadata":null,"md_url":null,"parse_error":null}
```

### 7. GET /api/v1/sessions/{session_id}/agents/{agent_id}/stream

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/agents/98860375-ac9d-42a5-a234-908b51f9d943/stream",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 200)

```text
event: workflow_start
data: {"agent_id":"98860375-ac9d-42a5-a234-908b51f9d943","intent":"deploy","session_id":"6ea698aa-cc68-480a-8fac-bd67c87d52a6","trace_id":"a8548b406dab7dde1195c01750582efe","trace_url":"http://10.10.20.96:17606/project/cmq93ei4s0006jecvxad2uvv3/traces/a8548b406dab7dde1195c01750582efe","subintent":"deploy.install","subintent_source":"gate_llm"}

event: node_progress
data: {"node":"UnimplementedNoticeNode","cycle":0,"label":null}

event: token
data: {"delta":"아직 기능(M9 커맨드 전달)이 구현되지 않아 처리할 수 없습니다.\n(설치 작업을 TEM 에 전달하는 커맨드 전달 도구가 현재 개발 범위에서 제외돼 있습니다. 설치를 대신 수행하지는 못하지만 설치 절차와 과거 같은 작업의 결과는 설치 절차 조회, 배포·패치 이력 조회로 확인하실 수 있습니다. M9는 현재 개발 범위에서 제외된 항목입니다)"}

event: workflow_end
data: {"agent_id":"98860375-ac9d-42a5-a234-908b51f9d943","status":"completed","answer":"아직 기능(M9 커맨드 전달)이 구현되지 않아 처리할 수 없습니다.\n(설치 작업을 TEM 에 전달하는 커맨드 전달 도구가 현재 개발 범위에서 제외돼 있습니다. 설치를 대신 수행하지는 못하지만 설치 절차와 과거 같은 작업의 결과는 설치 절차 조회, 배포·패치 이력 조회로 확인하실 수 있습니다. M9는 현재 개발 범위에서 제외된 항목입니다)","subintent":"deploy.install","elapsed_seconds":0.0,"mcp_docs":false,"output_guardrail":{"redaction":{"applied":false,"hits":0,"kinds":[]},"latency_ms":0},"degraded":true,"degrade_mode":"blocked","unavailable_tools":[{"tool":"M9","name":"커맨드 전달","status":"scope_excluded","role":"required"}],"unanswered_scope":[],"intent":"deploy","builder":"workflows:deploy","subintent_source":"gate_llm","mcp_tools_used":[]}


```

### 8. GET /api/v1/sessions

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/api/v1/sessions?status=active&sort_by=last_activity_at&order=desc&page=1&page_size=20",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 200)

```text
{"sessions":[{"session_id":"6ea698aa-cc68-480a-8fac-bd67c87d52a6","title":"2026-09-18 05:52 대화","message_count":2,"status":"active","created_at":"2026-09-18T05:52:44.875342Z","updated_at":"2026-09-18T05:52:45.974576Z","last_activity_at":"2026-09-18T05:52:45.945359Z"},{"session_id":"fe4f77ac-e161-413b-993b-d296861b6ab1","title":"smoke-test","message_count":2,"status":"active","created_at":"2026-09-18T05:50:27.298109Z","updated_at":"2026-09-18T05:50:28.717987Z","last_activity_at":"2026-09-18T05:50:28.255695Z"},{"session_id":"fbdc2951-e949-4f4b-bf24-807139bedc0e","title":"smoke-test","message_count":2,"status":"active","created_at":"2026-09-18T05:49:41.886642Z","updated_at":"2026-09-18T05:49:43.178771Z","last_activity_at":"2026-09-18T05:49:42.913139Z"},{"session_id":"21b9e3dd-b09b-4889-b51c-100d0bec4efe","title":"중지 기능 동작 확인 및 피드백","message_count":4,"status":"active","created_at":"2026-09-18T04:04:33.200071Z","updated_at":"2026-09-18T04:04:46.198287Z","last_activity_at":"2026-09-18T04:04:46.013368Z"},{"session_id":"d49f5fd1-4ab1-46cb-805c-c7f55e06e4da","title":"2026-09-16 09:32 대화","message_count":2,"status":"active","created_at":"2026-09-16T09:32:30.372074Z","updated_at":"2026-09-16T09:33:06.721550Z","last_activity_at":"2026-09-16T09:33:06.720847Z"},{"session_id":"82d5b174-e97e-44f4-974f-ec4083963ac6","title":"2026-09-16 05:41 대화","message_count":2,"status":"active","created_at":"2026-09-16T05:41:27.271384Z","updated_at":"2026-09-16T05:41:37.717199Z","last_activity_at":"2026-09-16T05:41:37.716640Z"},{"session_id":"cba653cb-8282-4983-83ad-477ba96a3c09","title":"2026-09-15 04:27 대화","message_count":2,"status":"active","created_at":"2026-09-15T04:27:26.857685Z","updated_at":"2026-09-15T04:27:44.247315Z","last_activity_at":"2026-09-15T04:27:44.246741Z"},{"session_id":"175f8cca-b51d-4fbc-9620-f542ec76e878","title":"2026-09-15 04:26 대화","message_count":2,"status":"active","created_at":"2026-09-15T04:26:30.349310Z","updated_at":"2026-09-15T04:26:36.165881Z","last_activity_at":"2026-09-15T04:26:36.165293Z"},{"session_id":"d6b2d7ae-0aa0-451e-9256-84c599a1b25d","title":"2026-09-15 04:24 대화","message_count":2,"status":"active","created_at":"2026-09-15T04:24:17.317010Z","updated_at":"2026-09-15T04:24:29.968178Z","last_activity_at":"2026-09-15T04:24:29.967445Z"},{"session_id":"7b764d03-dd43-4957-8da4-597902077cfd","title":"웹서비스-WebtoB-01 서버 배포 실패 분석 및 롤백 영향 범위","message_count":32,"status":"active","created_at":"2026-09-15T02:16:07.301514Z","updated_at":"2026-09-15T02:59:02.757438Z","last_activity_at":"2026-09-15T02:59:02.756704Z"},{"session_id":"a35444e2-5c83-4128-8694-9302b5738727","title":"등록 호스트 목록 및 인스턴스 상태 점검","message_count":11,"status":"active","created_at":"2026-09-15T01:50:48.295467Z","updated_at":"2026-09-15T01:52:51.830887Z","last_activity_at":"2026-09-15T01:52:51.830192Z"},{"session_id":"7a58353a-2554-4277-8381-3f3ded15850d","title":"오늘 날짜 조회 요청 및 운영 범위 안내","message_count":4,"status":"active","created_at":"2026-09-14T11:27:05.891598Z","updated_at":"2026-09-15T01:08:47.735637Z","last_activity_at":"2026-09-15T01:08:47.512199Z"},{"session_id":"a8153d4b-2d3d-4617-af77-fd6a55042790","title":"2026-09-15 00:53 대화","message_count":2,"status":"active","created_at":"2026-09-15T00:53:08.755873Z","updated_at":"2026-09-15T00:53:17.262150Z","last_activity_at":"2026-09-15T00:53:17.261581Z"},{"session_id":"e4b1ea28-f592-45f1-b4ad-d268a0d4dead","title":"2026-09-15 00:52 대화","message_count":2,"status":"active","created_at":"2026-09-15T00:52:06.962363Z","updated_at":"2026-09-15T00:52:19.861535Z","last_activity_at":"2026-09-15T00:52:19.860793Z"},{"session_id":"1344ac02-7854-4ed6-b2cd-3c484dcbaa6b","title":"WEB-07 서버 사양 및 정보 확인","message_count":4,"status":"active","created_at":"2026-09-15T00:49:32.083902Z","updated_at":"2026-09-15T00:51:03.324465Z","last_activity_at":"2026-09-15T00:51:03.103586Z"},{"session_id":"58e15f6e-2d8d-4558-90ec-39f093013c5a","title":"2026-09-14 11:31 대화","message_count":2,"status":"active","created_at":"2026-09-14T11:31:58.115756Z","updated_at":"2026-09-14T11:31:59.432351Z","last_activity_at":"2026-09-14T11:31:59.431731Z"},{"session_id":"814e3fa7-3d53-411c-b5a9-c450b9b4a9ff","title":"WEB-01 서버 CPU 임계값 권고 요청","message_count":14,"status":"active","created_at":"2026-09-14T11:27:35.944681Z","updated_at":"2026-09-14T11:31:03.184343Z","last_activity_at":"2026-09-14T11:31:03.183584Z"},{"session_id":"7cee65bc-cdfa-402a-84f3-4f0d893e9a20","title":"WebtoB 호스트 등록 방법 안내","message_count":8,"status":"active","created_at":"2026-09-14T08:51:20.012784Z","updated_at":"2026-09-14T08:53:26.468493Z","last_activity_at":"2026-09-14T08:53:26.467925Z"},{"session_id":"8dd86c09-3b74-4bdb-97c5-a7fec2fcc024","title":"장애 발생 여부 확인 요청","message_count":8,"status":"active","created_at":"2026-09-14T05:31:33.822508Z","updated_at":"2026-09-14T05:32:33.344682Z","last_activity_at":"2026-09-14T05:32:33.343802Z"},{"session_id":"6eb7b085-0b09-4009-906c-4823b0eb8342","title":"2026-09-14 05:30 대화","message_count":2,"status":"active","created_at":"2026-09-14T05:30:10.525448Z","updated_at":"2026-09-14T05:30:11.138599Z","last_activity_at":"2026-09-14T05:30:11.137975Z"}],"page":1,"page_size":20,"total":180}
```

### 9. GET /api/v1/sessions/{session_id}

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 200)

```text
{"session_id":"6ea698aa-cc68-480a-8fac-bd67c87d52a6","title":null,"status":"active","message_count":2,"created_at":"2026-09-18T05:52:44.875342Z","updated_at":"2026-09-18T05:52:45.974576Z"}
```

### 10. PATCH /api/v1/sessions/{session_id}

#### Request

```json
{
  "method": "PATCH",
  "url": "http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6",
  "headers": {},
  "body": {
    "title": "smoke-test"
  }
}
```

#### Response (HTTP 200)

```text
{"session_id":"6ea698aa-cc68-480a-8fac-bd67c87d52a6","title":"smoke-test","status":"active","message_count":2,"created_at":"2026-09-18T05:52:44.875342Z","updated_at":"2026-09-18T05:52:46.405070Z"}
```

### 11. GET /api/v1/sessions/{session_id}/active-run

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/active-run",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 200)

```text
{"run_id":null}
```

### 12. GET /api/v1/sessions/{session_id}/messages

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/messages?limit=50&cursor=smoke-test&direction=after",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 200)

```text
{"session_id":"6ea698aa-cc68-480a-8fac-bd67c87d52a6","messages":[],"prev_cursor":null,"next_cursor":null,"has_more_before":false,"has_more_after":false}
```

### 13. GET /api/v1/kb

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/api/v1/kb?kb_scope=public",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 200)

```text
{"kb_list":[{"kb_id":"aa340ad9-8d8e-4649-a079-53adcf6ab897","kb_name":"WebtoB 6.1"},{"kb_id":"2205510d-a359-4c59-a917-e8d4401ee9bc","kb_name":"Tmax 6Fix1"},{"kb_id":"87d4507a-89e1-4bbf-889b-51dc92518e42","kb_name":"ProObject 7Fix1"},{"kb_id":"e8ad9d97-33a4-46f1-8ac0-9bd17df1b6d7","kb_name":"ProFrame 5Fix1"},{"kb_id":"652d824e-4bb2-4ce3-9dc2-0b4bc9e2679c","kb_name":"JEUS 9.1"},{"kb_id":"55153530-9f7c-4fb2-a403-d03a5b3cdd4c","kb_name":"JEUS 21.2"},{"kb_id":"2a5601ed-b2ec-4efd-a4e5-9ca93693a950","kb_name":"HyperFrame Manager 21Fix1"},{"kb_id":"07bae410-3158-4c90-98f5-5ceaa0cfa42c","kb_name":"AnySim 2.0"},{"kb_id":"864f6db3-e196-437a-9537-1b68b769c33c","kb_name":"AnyLink 7.5"},{"kb_id":"7ac70547-5c37-45da-9caa-f98f94b76635","kb_name":"AnyEIMS 1.0"},{"kb_id":"afba8c52-3fd3-4a3c-bb89-776e332e2b2f","kb_name":"AnyAPI 1.0"},{"kb_id":"2492d292-e519-4361-ae39-351e977effff","kb_name":"AIOps RCA 제품군·계층경계"},{"kb_id":"9dc9fbe8-429a-40ec-b9cf-da8cb6d18786","kb_name":"AIOps RCA 제품별 플레이북"},{"kb_id":"b09d0064-9045-4eab-a9c7-7658beef2678","kb_name":"AIOps RCA 장애보고서"},{"kb_id":"1f75f67a-f19c-4175-904f-dac9c8a1be1c","kb_name":"AIOps Workflow 정의"},{"kb_id":"6792e1d5-98f9-4ced-9eea-1a78c305970c","kb_name":"AIOps MCP 정의"}]}
```

### 14. GET /api/v1/documents/{document_id}/content

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/api/v1/documents/b738dc4a-6ed1-40df-bf50-d2cc3fd87be3/content?filename=smoke-test",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 404)

```text
{"type":"https://aiops-agent/errors/not-found","title":"Not Found","status":404,"detail":"문서를 찾을 수 없습니다: b738dc4a-6ed1-40df-bf50-d2cc3fd87be3","instance":"http://10.10.20.96:17600/api/v1/documents/b738dc4a-6ed1-40df-bf50-d2cc3fd87be3/content?filename=smoke-test","trace_id":"663c41d3-4ab3-4136-aa54-2bd6ef048550"}
```

### 15. GET /api/v1/documents/{document_id}/preview-url

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/api/v1/documents/b738dc4a-6ed1-40df-bf50-d2cc3fd87be3/preview-url",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 200)

```text
{"document_id":"b738dc4a-6ed1-40df-bf50-d2cc3fd87be3","download_url":"/api/be/documents/b738dc4a-6ed1-40df-bf50-d2cc3fd87be3/content","title":null}
```

### 16. POST /api/v1/sessions/{session_id}/documents

#### Request

```json
{
  "method": "POST",
  "url": "http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/documents",
  "headers": {},
  "body": {}
}
```

#### Response (HTTP 202)

```text
{"job_id":"217b4a4d-c84b-4a78-b0ac-40289bc5a6e4","message_id":"1204f5e3-3b9b-43c8-b696-e4e6ddff0d13","scope":"last_answer","status":"accepted"}
```

### 17. GET /api/v1/artifacts/{artifact_id}/download

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/api/v1/artifacts/smoke-test/download",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 404)

```text
{"type":"https://aiops-agent/errors/not-found","title":"Not Found","status":404,"detail":"kbqna-back: {\"error_code\":\"ARTIFACT_001\",\"message\":\"산출물을 찾을 수 없습니다: smoke-test\",\"details\":{}}","instance":"http://10.10.20.96:17600/api/v1/artifacts/smoke-test/download","trace_id":"4efa9af5-d22b-4441-a6aa-ae35635c3a16"}
```

### 18. POST /api/v1/ingest

#### Request

```json
{
  "method": "POST",
  "url": "http://10.10.20.96:17600/api/v1/ingest?kb_id=aa340ad9-8d8e-4649-a079-53adcf6ab897",
  "headers": {},
  "body": "multipart file: smoke.txt"
}
```

#### Response (HTTP 200)

```text
{"request_id":"7f1bc133-c644-4794-9ae8-e82552642c55","status":"duplicate","message":"모든 파일이 이미 KB에 존재합니다 (1개 중복, KB: aa340ad9-8d8e-4649-a079-53adcf6ab897). 임베딩 생성을 건너뜁니다.","files":[{"file_id":"976971ec-1ad1-4e46-8346-56cb11e670d2","filename":"smoke.txt","is_duplicate":true}]}
```

### 19. GET /api/v1/ingest/status

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/api/v1/ingest/status?kb_id=aa340ad9-8d8e-4649-a079-53adcf6ab897",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 200)

```text
{"kb_id":"aa340ad9-8d8e-4649-a079-53adcf6ab897","kb_name":"WebtoB 6.1","total":4,"stages":{"parsing":{"completed":0,"in_progress":0,"failed":0,"pending":4},"chunking":{"completed":0,"in_progress":0,"failed":0,"pending":4},"embedding":{"completed":0,"in_progress":0,"failed":0,"pending":4}},"all_completed":0,"any_failed":0,"files":[{"file_id":"19add049-098b-4788-8afa-098aa81003b8","filename":"WebtoB_6.1.2_Administrator-Guide_v3.3.1_ko.pdf","kb_status":"completed","stages":{"parsing":"pending","chunking":"pending","embedding":"pending"}},{"file_id":"071644d9-cb74-4fcb-8e25-86900869baf5","filename":"WebtoB_6.1.2_Installation-Guide_v3.3.1_ko.pdf","kb_status":"completed","stages":{"parsing":"pending","chunking":"pending","embedding":"pending"}},{"file_id":"9bd73986-0373-4bf4-8dcf-7ef109a08b1b","filename":"WebtoB_6.1.2_Release-Note_v3.3.1_ko.pdf","kb_status":"completed","stages":{"parsing":"pending","chunking":"pending","embedding":"pending"}},{"file_id":"a91fb419-35ea-43f4-a570-7ecbc009c67c","filename":"smoke.txt","kb_status":"completed","stages":{"parsing":"pending","chunking":"pending","embedding":"pending"}}]}
```

### 20. POST /api/v1/ingest/cancel

#### Request

```json
{
  "method": "POST",
  "url": "http://10.10.20.96:17600/api/v1/ingest/cancel?kb_id=aa340ad9-8d8e-4649-a079-53adcf6ab897&file_id=976971ec-1ad1-4e46-8346-56cb11e670d2",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 404)

```text
{"type":"https://aiops-agent/errors/not-found","title":"Not Found","status":404,"detail":"kbqna-back: {\"error_code\":\"DOCUMENT_001\",\"message\":\"Document with ID '976971ec-1ad1-4e46-8346-56cb11e670d2' not found\",\"details\":{\"file_id\":\"976971ec-1ad1-4e46-8346-56cb11e670d2\"}}","instance":"http://10.10.20.96:17600/api/v1/ingest/cancel?kb_id=aa340ad9-8d8e-4649-a079-53adcf6ab897&file_id=976971ec-1ad1-4e46-8346-56cb11e670d2","trace_id":"23377b1b-d638-405c-8dfb-6f815d449638"}
```

### 21. GET /api/v1/settings/suggested-questions

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/api/v1/settings/suggested-questions",
  "headers": {
    "x-api-key": "smoke-test"
  },
  "body": null
}
```

#### Response (HTTP 200)

```text
{"enabled":true,"max":3,"source":"override"}
```

### 22. PUT /api/v1/settings/suggested-questions

#### Request

```json
{
  "method": "PUT",
  "url": "http://10.10.20.96:17600/api/v1/settings/suggested-questions",
  "headers": {
    "x-api-key": "smoke-test"
  },
  "body": {
    "enabled": false
  }
}
```

#### Response (HTTP 401)

```text
{"detail":"invalid api key"}
```

### 23. GET /health

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/health",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 200)

```text
{"status":"ok","service":"aiops-agent","version":"0.1.3"}
```

### 24. GET /healthz

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/healthz",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 200)

```text
{"status":"ready","checks":{"llm":"ok","mcp":"ok"},"mcp":{"servers":[{"id":"tem","connected":true,"required":false,"tool_count":9,"serving_as_fallback":0},{"id":"mock","connected":true,"required":false,"tool_count":5,"serving_as_fallback":5}],"unavailable_count":0}}
```

### 25. GET /readyz

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/readyz",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 200)

```text
{"status":"ready","registered":{"shared":["C1_MCPResponseCache","C2_RAGResultCache","C3_SessionTargetCache","E1_MCPRetryHandler","E2_LLMFallbackHandler","E3_CircuitBreaker","KbqnaClient","L1_ExecutionLogger","L2_AuditLogger","L3_ErrorLogger","V1_StateValidator","V2_InputFormatValidator"],"dedicated":["A1_LogSummarizer","A2_ImpactAnalyzer","A3_RiskScorer","A4_ThresholdAdvisor","A5_AlertNoiseAdvisor","A6_ThresholdBreachSimulator","H1_CommandConfirmHandler","H2_DeployStepConfirmHandler","LLM_120B","LLM_20B","LLM_TOOL","M11_ResolveName","M12_JobInfoQuery","M13_AssetHierarchyQuery","M14_ListResources","M15_EventQuery","M1_LogQuery","M2_MetricQuery","M3_SnapshotQuery","M4_TopologyQuery","M5_AlertQuery","M6_ResourceCheck","M7_PatchStatus","M8_JobStatQuery","M9_CommandListSender","O1_CommandListFormatter","O2_RCAResultFormatter","O3_RecommendFormatter","O4_ReportFormatter","O5_ComplianceResultFormatter","P1_RCAPromptBuilder","P2_CommandListPromptBuilder","P3_DeployCheckPromptBuilder","P4R_RcaReportPromptBuilder","P4_ReportPromptBuilder","P5_CompliancePromptBuilder","P6_SemanticSearchPromptBuilder","PromptLoader","R1_IncidentCaseRetriever","R2_TroubleshootingGuideRetriever","R3_InstallGuideRetriever","R4_SecurityPolicyRetriever","R5_AlertThresholdRetriever","R6_OperationKnowledgeRetriever","RF01_IntentClassifier","SkillLoader"]},"mcp_tools":{"available":[{"id":"M1_LogQuery","server":"tem","tool":"M1_query_logs"},{"id":"M2_MetricQuery","server":"tem","tool":"M2_query_metrics"},{"id":"M3_SnapshotQuery","server":"mock","tool":"M3_snapshot_query","fallback_of":"tem","primary_reason":"not_in_catalog"},{"id":"M4_TopologyQuery","server":"mock","tool":"M4_topology_query","fallback_of":"tem","primary_reason":"not_in_catalog"},{"id":"M5_AlertQuery","server":"mock","tool":"M5_query_alerts","fallback_of":"tem","primary_reason":"not_in_catalog"},{"id":"M6_ResourceCheck","server":"tem","tool":"M6_check_resource"},{"id":"M7_PatchStatus","server":"mock","tool":"M7_patch_status","fallback_of":"tem","primary_reason":"not_in_catalog"},{"id":"M8_JobStatQuery","server":"tem","tool":"M8_query_job_stats"},{"id":"M9_CommandListSender","server":"mock","tool":"M9_command_send","fallback_of":"tem","primary_reason":"not_in_catalog"},{"id":"M11_ResolveName","server":"tem","tool":"M11_resolve_name"},{"id":"M12_JobInfoQuery","server":"tem","tool":"M12_query_job_history"},{"id":"M13_AssetHierarchyQuery","server":"tem","tool":"M13_query_asset_hierarchy"},{"id":"M14_ListResources","server":"tem","tool":"M14_list_resources"},{"id":"M15_EventQuery","server":"tem","tool":"M15_query_events"}],"unavailable":[],"passthrough":[]}}
```

### 26. GET /api/v1/sessions/{session_id}/agents/{agent_id}/hitl-status

#### Request

```json
{
  "method": "GET",
  "url": "http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/agents/98860375-ac9d-42a5-a234-908b51f9d943/hitl-status",
  "headers": {},
  "body": null
}
```

#### Response (HTTP 200)

```text
{"agent_id":"98860375-ac9d-42a5-a234-908b51f9d943","intent":"deploy","status":"completed","current_node":"UnimplementedNoticeNode","session_id":"6ea698aa-cc68-480a-8fac-bd67c87d52a6"}
```

### 27. POST /api/v1/sessions/{session_id}/agents/{agent_id}/hitl-resume

#### Request

```json
{
  "method": "POST",
  "url": "http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/agents/98860375-ac9d-42a5-a234-908b51f9d943/hitl-resume",
  "headers": {},
  "body": {
    "decision": "rejected"
  }
}
```

#### Response (HTTP 409)

```text
{"type":"https://aiops-agent/errors/conflict","title":"Conflict","status":409,"detail":"agent 98860375-ac9d-42a5-a234-908b51f9d943 is not paused (status=completed)","instance":"http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/agents/98860375-ac9d-42a5-a234-908b51f9d943/hitl-resume","trace_id":"0c73ac79-2f41-45eb-ba29-a8e7502f81fb"}
```

### 28. POST /api/v1/sessions/{session_id}/agents/{agent_id}/hitl-cancel

#### Request

```json
{
  "method": "POST",
  "url": "http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/agents/98860375-ac9d-42a5-a234-908b51f9d943/hitl-cancel",
  "headers": {},
  "body": {
    "reason": "HITL smoke test cancellation"
  }
}
```

#### Response (HTTP 409)

```text
{"type":"https://aiops-agent/errors/conflict","title":"Conflict","status":409,"detail":"agent 98860375-ac9d-42a5-a234-908b51f9d943 already terminal (status=completed)","instance":"http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/agents/98860375-ac9d-42a5-a234-908b51f9d943/hitl-cancel","trace_id":"5dd42dbb-fed1-43dd-9e9a-4654e0bbd568"}
```
