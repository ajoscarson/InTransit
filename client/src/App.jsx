import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoadingSpinner from './components/LoadingSpinner';

import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import NewRollPage from './pages/NewRollPage';
import RollDetailPage from './pages/RollDetailPage';
import CamerasPage from './pages/CamerasPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"  element={<AuthPage mode="signin" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />

      <Route path="/" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/rolls/new" element={
        <ProtectedRoute><NewRollPage /></ProtectedRoute>
      } />
      <Route path="/rolls/:id" element={
        <ProtectedRoute><RollDetailPage /></ProtectedRoute>
      } />
      <Route path="/cameras" element={
        <ProtectedRoute><CamerasPage /></ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute><SettingsPage /></ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
