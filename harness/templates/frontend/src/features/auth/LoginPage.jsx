import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: 'admin@example.com', password: 'admin' });
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    try { setError(''); await signIn(form.email, form.password); }
    catch (reason) { setError(reason.message); }
  };
  return <main className="login-page"><form className="login-card" onSubmit={submit}>
    <div className="brand login-brand"><span className="brand-mark">●</span><strong>LLM Lab</strong></div>
    <h1>로그인</h1><p className="muted">서비스를 이용하려면 로그인해 주세요.</p>
    <label>이메일<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
    <label>비밀번호<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
    {error && <p className="error" role="alert">{error}</p>}<button className="btn btn-primary btn-wide">로그인</button>
    <small className="demo-hint">데모: admin@example.com / admin</small>
  </form></main>;
}
