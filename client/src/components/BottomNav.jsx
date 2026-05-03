import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, PlusCircle, Camera, Settings } from 'lucide-react';

const TABS = [
  { label: 'Home',     icon: Home,        path: '/' },
  { label: 'New Roll', icon: PlusCircle,  path: '/rolls/new' },
  { label: 'Cameras',  icon: Camera,      path: '/cameras' },
  { label: 'Settings', icon: Settings,    path: '/settings' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#141414',
        borderTop: '1px solid #2a2a2a',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '0.5rem 0 calc(0.5rem + env(safe-area-inset-bottom))',
        zIndex: 100,
      }}
    >
      {TABS.map(({ label, icon: Icon, path }) => {
        const isActive = path === '/' ? pathname === '/' : pathname.startsWith(path);
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.2rem',
              padding: '0.25rem 1rem',
              color: isActive ? '#e8d5b0' : '#666',
              fontSize: '0.7rem',
              fontWeight: isActive ? 700 : 400,
              transition: 'color 0.15s',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.75} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
