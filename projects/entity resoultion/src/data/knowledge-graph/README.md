# 지식 그래프 관리 원본

이 폴더가 지식 그래프 JSON의 관리 원본입니다. 항목·관계·매핑을 수정한 후 아래 명령을 실행하면 브라우저가 읽는 `public/data/knowledge-graph`로 복사됩니다.

```powershell
npm run data:publish
```

기존 단일 JSON에서 최초 분할이 필요한 경우에만 `npm run data:migrate-legacy`를 사용합니다. 일상적인 수정 후에는 실행하지 않습니다.
