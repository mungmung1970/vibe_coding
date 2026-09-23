# API 목록 및 테스트 결과

- Base URL: `http://10.10.20.96:17600`
- 테스트 API 수: **28**
- 성공: **22**
- 실패: **6**
- 삭제 메서드: 테스트 제외

| 번호 | Method | API | HTTP | 성공여부 | 실패/응답 요약 |
|  | `` | `` |  |  | |
|  | `` | `` |  |  |  |
|  | `` | `` |  |  |  |
|  | `` | `` |  |  |  |
|  | `` | `` |  |  |  |
|  | `` | `` |  |  |  |
|  | `` | `` |  |  |  |
|  | `` | `` |  |  |  |
|  | `` | `` |  |  |  |
|  | `` | `` |  |  |  |
|  | `` | `` |  |  | |
|  | `` | `` |  | 실패 | {"type":"https://aiops-agent/errors/not-found","title":"Not Found","status":404,"detail":"문서를 찾을 수 없습니다: b738dc4a-6ed1-40df-bf50-d2cc3fd87be3","instance":"http://10.10.20.96:17600/api/v1/documents/b738dc4a-6ed1-40df-bf50-d2cc3fd87be3/content?filename=smoke-test","trace_id":"663c41d3-4ab3-4136-aa54-2 |
|  | `` | `` |  |  |  |
|  | `` | `` |  |  |  |
|  | `` | `` | 404 | 실패 | {"type":"https://aiops-agent/errors/not-found","title":"Not Found","status":404,"detail":"kbqna-back: {\"error_code\":\"ARTIFACT_001\",\"message\":\"산출물을 찾을 수 없습니다: smoke-test\",\"details\":{}}","instance":"http://10.10.20.96:17600/api/v1/artifacts/smoke-test/download","trace_id":"4efa9af5-d22b-4441 |
|  | `` | `` |  |  | |
|  | `` | `` |  |  |  |
|  | `` | `` |  | 실패 | {"type":"https://aiops-agent/errors/not-found","title":"Not Found","status":404,"detail":"kbqna-back: {\"error_code\":\"DOCUMENT_001\",\"message\":\"Document with ID '976971ec-1ad1-4e46-8346-56cb11e670d2' not found\",\"details\":{\"file_id\":\"976971ec-1ad1-4e46-8346-56cb11e670d2\"}}","instance":"ht |
|  | `` | `` |  |  |  |
|  | `` | `` |  | 실패 | {"detail":"invalid api key"} |
|  | `` | `` |  |  |  |
|  | `` | `` |  |  |  |
|  | `` | `` |  |  |  |
|  | `` | `` |  |  |  |
|  | `` | `` |  |  | {"type":"https://aiops-agent/errors/conflict","title":"Conflict","status":409,"detail":"agent 98860375-ac9d-42a5-a234-908b51f9d943 is not paused (status=completed)","instance":"http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/agents/98860375-ac9d-42a5-a234-908b51f9d943/h |
|  | `` | `` | 409 | 실패 | {"type":"https://aiops-agent/errors/conflict","title":"Conflict","status":409,"detail":"agent 98860375-ac9d-42a5-a234-908b51f9d943 already terminal (status=completed)","instance":"http://10.10.20.96:17600/api/v1/sessions/6ea698aa-cc68-480a-8fac-bd67c87d52a6/agents/98860375-ac9d-42a5-a234-908b51f9d94 |
