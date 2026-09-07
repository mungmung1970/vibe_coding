import { demoUsers } from '../data/sample.js';

export async function login(email, password) {
  // Demo only. Replace this function with POST /api/auth/login before production.
  const user = demoUsers.find((candidate) => candidate.email === email && candidate.password === password);
  if (!user) throw new Error('이메일 또는 비밀번호를 확인해 주세요.');
  return { email: user.email, name: user.name, role: user.role };
}
