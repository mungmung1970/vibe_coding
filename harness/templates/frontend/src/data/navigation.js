export const navigation = [
  { id: 'prompt', label: '프롬프트 테스트', permission: ['prompt', 'read'] },
  { id: 'compare', label: '결과 조회', permission: ['result', 'read'] },
  { id: 'admin', label: '관리자 모드', permission: ['admin', 'read'] },
];

export const menuPermissions = [
  { id: 'prompt', label: '프롬프트 테스트', description: '모델 입력과 실행 결과', actions: ['read', 'manage'] },
  { id: 'result', label: '결과 조회', description: '저장된 결과와 비교', actions: ['read', 'manage'] },
  { id: 'admin', label: '관리자 모드', description: '사용자·메뉴 권한 설정', actions: ['read', 'manage'] },
];
