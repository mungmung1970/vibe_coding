# TASK-002 · EXECUTION

실행일: 2026-09-07
계획: docs/runs/TASK-002/PLAN.md (승인됨)
명세: docs/spec/features/FEAT-002-thinking-progress.md

## 변경 내역

| 파일 | 변경 |
| --- | --- |
| `src/frontend/src/utils/format.js` | 순수 함수 2개 추가 — `formatThinkingProgress`(진행 문구), `formatReasoningTokens`(사고 토큰 표시) |
| `src/frontend/src/components/prompt-view.js` | 본문이 비어 있고 사고 델타가 흐르는 동안 진행 문구 렌더, 완료 통계에 사고 토큰 추가, 스트림 시작 시각 추적 |
| `src/frontend/src/styles/index.css` | `.thinking-progress` 스타일(맥동하는 점 + 강조색 문구) |
| `src/frontend/tests/unit.test.js` | 진행 문구·사고 토큰 표시 단위 테스트 2건(케이스 7개) 추가 |

백엔드 변경 없음. 계획한 방안 B를 그대로 구현했고 신규 상태 필드도 추가하지 않았다. 순 증가 약 45줄.

## 구현 메모

- 진행 문구는 `answer.reasoning` 누적 길이와 스트림 시작 이후 경과 시간만으로 만든다. 갱신은 기존 60ms throttle 경로를 그대로 타므로 별도 타이머가 없다. "살아 있는" 느낌은 CSS 애니메이션(`pulse`)이 담당한다.
- 스트림 시작 시각은 뷰 지역 변수(`streamStartedAt`)로 둔다. 스트리밍 도중 전체 리렌더가 일어나면 경과 시간이 다시 0부터 세지만, 리렌더는 서빙 상태 변화 등에서만 발생하고 표시는 참고용이라 상태 필드를 늘리지 않는 쪽을 택했다(계획과 동일).
- `show_thinking` 분기는 기존 로직을 유지했다. 진행 문구는 사고 **내용**을 담지 않으므로 설정이 꺼져 있어도 정책 위반이 아니다.
- 사고 토큰 수는 `usage.completion_tokens_details.reasoning_tokens`가 0보다 클 때만 덧붙인다.
