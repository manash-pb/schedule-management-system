import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './Login';
import AdminDashboard from './AdminDashboard';
import UserDashboard from './UserDashboard';
import UserProfile from './UserProfile';
import NotificationsPage from './NotificationsPage';
import PostNotification from './PostNotification';
import Layout from './Layout';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import { getAuthData } from '../utils/authStorage';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  // --- THESE ARE THE MISSING FUNCTIONS ---
  // They check localStorage to see who is logged in before letting them view a page
  const isAuthenticated = () => getAuthData('isAdminLoggedIn') === 'true';
  const isAdmin = () => getAuthData('userRole') === 'admin';
  // ---------------------------------------

  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={isAuthenticated() ? <Navigate to={isAdmin() ? '/admin-dashboard' : '/user-dashboard'} replace /> : <Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected Admin Route */}
        <Route
          path="/admin-dashboard"
          element={(isAuthenticated() && isAdmin()) ? <Layout><AdminDashboard /></Layout> : <Navigate to="/" />}
        />

        {/* Protected Admin Post Notification Route */}
        <Route
          path="/admin/post-notification"
          element={(isAuthenticated() && isAdmin()) ? <Layout><PostNotification /></Layout> : <Navigate to="/" />}
        />

        {/* Protected User Route */}
        <Route
          path="/user-dashboard"
          element={isAuthenticated() ? <Layout><UserDashboard /></Layout> : <Navigate to="/" />}
        />

        {/* Protected Profile Route */}
        <Route
          path="/profile"
          element={isAuthenticated() ? <Layout><UserProfile /></Layout> : <Navigate to="/" />}
        />

        {/* Protected Notifications Route */}
        <Route
          path="/notifications"
          element={isAuthenticated() ? <Layout><NotificationsPage /></Layout> : <Navigate to="/" />}
        />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;