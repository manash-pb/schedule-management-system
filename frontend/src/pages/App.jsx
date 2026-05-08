import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

const Login = lazy(() => import('./Login'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const UserDashboard = lazy(() => import('./UserDashboard'));
const PastEvents = lazy(() => import('./PastEvents'));
const LiveEvents = lazy(() => import('./LiveEvents'));
const UserProfile = lazy(() => import('./UserProfile'));
const Layout = lazy(() => import('./Layout'));

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const isAuthenticated = localStorage.getItem('isAdminLoggedIn') === 'true';
  const isAdmin = localStorage.getItem('userRole') === 'admin';
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <Router>
      <Suspense fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', background: '#ffffff' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              border: '4px solid rgba(100, 116, 139, 0.25)',
              borderTop: '4px solid #2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <div style={{ color: '#334155', fontSize: 16, fontWeight: 500 }}>Loading...</div>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      }>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/admin-dashboard" element={<ProtectedRoute adminOnly><Layout><AdminDashboard /></Layout></ProtectedRoute>} />
          <Route path="/user-dashboard" element={<ProtectedRoute><Layout><UserDashboard /></Layout></ProtectedRoute>} />
          <Route path="/past-events" element={<ProtectedRoute><Layout><PastEvents /></Layout></ProtectedRoute>} />
          <Route path="/live-events" element={<ProtectedRoute><Layout><LiveEvents /></Layout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Layout><UserProfile /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;