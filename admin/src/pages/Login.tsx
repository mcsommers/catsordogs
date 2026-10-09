import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { status, rejection, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (status === 'admin') return <Navigate to="/questions" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const message = await signIn(email, password);
    setPending(false);
    if (message) setError(message);
  }

  return (
    <form className="login card stack" onSubmit={onSubmit}>
      <h1>Admin sign in</h1>
      <p className="muted">
        Use the email and password of someone already on the admin list. There is no Create Account
        here. Apple and Google sign-in are not on this tool yet.
      </p>
      {status === 'loading' ? <p className="muted">Checking who you are…</p> : null}
      {rejection ? <p className="error">{rejection}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <label>
        Email
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <button className="primary" type="submit" disabled={pending || status === 'loading'}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
