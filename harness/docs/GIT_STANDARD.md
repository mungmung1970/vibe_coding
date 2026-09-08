# Git 표준

모든 커밋·푸시는 [Loop Engineering](LOOP_ENGINEERING.md)의 검증 게이트를 따릅니다.

## 순서

```sh
git status --short
git diff --check
git diff --stat
git add <의도한 파일>
git commit -m "<type>: <변경 내용>"
git push -u origin <현재 브랜치>
```

테스트·빌드·보안 검사가 통과하기 전에는 commit/push하지 않습니다. `.env`, API 키,
토큰, 인증서, 개인키, 로그, 모델 가중치, `node_modules`, 빌드 산출물은 커밋하지 않습니다.

인증이 필요하면 웹 인증을 완료한 뒤 `gh auth status`로 확인합니다. 인증 실패,
충돌, 원격 브랜치 변경, 대상이 불명확한 경우에는 중단합니다.
