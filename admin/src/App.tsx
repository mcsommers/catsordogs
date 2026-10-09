import type { ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAdmin, useAuth } from './auth';
import Login from './pages/Login';
import Questions from './pages/Questions';
import Settings from './pages/Settings';
import Queue from './pages/Queue';
import People from './pages/People';
import Videos from './pages/Videos';
import ProfileQuestions from './pages/ProfileQuestions';

const links = [
  ['/questions', 'Questions'],
  ['/settings', 'Settings'],
  ['/queue', 'Review queue'],
  ['/people', 'People'],
  ['/videos', 'Videos'],
  ['/profile-questions', 'Profile questions'],
] as const;

function Shell({ children }: { children: ReactNode }) {
  const { email, signOut } = useAuth();
  return (
    <div className="app-shell">
      <div className="top">
        <h1>Cats or Dogs? admin</h1>
        <div className="row">
          <span className="muted">{email}</span>
          <button type="button" onClick={() => signOut()}>Sign out</button>
        </div>
      </div>
      <nav>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            {label}
          </NavLink>
        ))}
      </nav>
      {children}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/questions" element={<RequireAdmin><Shell><Questions /></Shell></RequireAdmin>} />
      <Route path="/settings" element={<RequireAdmin><Shell><Settings /></Shell></RequireAdmin>} />
      <Route path="/queue" element={<RequireAdmin><Shell><Queue /></Shell></RequireAdmin>} />
      <Route path="/people" element={<RequireAdmin><Shell><People /></Shell></RequireAdmin>} />
      <Route path="/videos" element={<RequireAdmin><Shell><Videos /></Shell></RequireAdmin>} />
      <Route path="/profile-questions" element={<RequireAdmin><Shell><ProfileQuestions /></Shell></RequireAdmin>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
