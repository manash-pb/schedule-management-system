import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './Login';
import AdminDashboard from './AdminDashboard';
import UserDashboard from './UserDashboard';
import PastEvents from './PastEvents';
import LiveEvents from './LiveEvents';
import UserProfile from './UserProfile';
import Layout from './Layout';

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
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/admin-dashboard" element={<ProtectedRoute adminOnly><Layout><AdminDashboard /></Layout></ProtectedRoute>} />
          <Route path="/user-dashboard" element={<ProtectedRoute><Layout><UserDashboard /></Layout></ProtectedRoute>} />
          <Route path="/past-events" element={<ProtectedRoute><Layout><PastEvents /></Layout></ProtectedRoute>} />
          <Route path="/live-events" element={<ProtectedRoute><Layout><LiveEvents /></Layout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Layout><UserProfile /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </Router>
  );
}

export default App;