import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [id, setId] = useState('admin@example.com');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const submit = (event) => { event.preventDefault(); try { signIn(id, password); } catch (cause) { setError(cause.message); } };
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}>
    <h1>LLM Lab</h1><p>템플릿 로그인</p>
    <label className="form-row"><span>로그인 ID</span><input type="email" value={id} onChange={(event) => setId(event.target.value)} autoComplete="username" /></label>
    <label className="form-row"><span>비밀번호</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="btn btn-primary" type="submit">로그인</button><small>데모: admin@example.com / admin</small>
  </form></main>;
}
