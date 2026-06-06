import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MantineProvider, createTheme } from '@mantine/core';
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

const mantineTheme = createTheme({
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
  primaryColor: 'blue',
  radius: { sm: '8px', md: '12px', lg: '16px' },
});

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

import { useMantineColorScheme } from '@mantine/core';

function ColorSchemeSync() {
  const { setColorScheme } = useMantineColorScheme();
  useEffect(() => {
    const sync = () => setColorScheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [setColorScheme]);
  return null;
}

function App() {
  const isAuthenticated = () => getAuthData('isAdminLoggedIn') === 'true';
  const isAdmin = () => getAuthData('userRole') === 'admin';

  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme="auto">
      <ColorSchemeSync />
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={isAuthenticated() ? <Navigate to={isAdmin() ? '/admin-dashboard' : '/user-dashboard'} replace /> : <Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin-dashboard"
            element={(isAuthenticated() && isAdmin()) ? <Layout><AdminDashboard /></Layout> : <Navigate to="/" />}
          />
          <Route
            path="/admin/post-notification"
            element={(isAuthenticated() && isAdmin()) ? <Layout><PostNotification /></Layout> : <Navigate to="/" />}
          />

          {/* Protected User Routes */}
          <Route
            path="/user-dashboard"
            element={isAuthenticated() ? <Layout><UserDashboard /></Layout> : <Navigate to="/" />}
          />
          <Route
            path="/profile"
            element={isAuthenticated() ? <Layout><UserProfile /></Layout> : <Navigate to="/" />}
          />
          <Route
            path="/notifications"
            element={isAuthenticated() ? <Layout><NotificationsPage /></Layout> : <Navigate to="/" />}
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </MantineProvider>
  );
}

export default App;
