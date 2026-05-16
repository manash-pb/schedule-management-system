import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import AdminDashboard from './AdminDashboard';
import UserDashboard from './UserDashboard';
import UserProfile from './UserProfile';
import Layout from './Layout';
import { getAuthData } from '../utils/authStorage';

function App() {
  // --- THESE ARE THE MISSING FUNCTIONS ---
  // They check localStorage to see who is logged in before letting them view a page
  const isAuthenticated = () => getAuthData('isAdminLoggedIn') === 'true';
  const isAdmin = () => getAuthData('userRole') === 'admin';
  // ---------------------------------------

  return (
    <Router>
      <Routes>
        {/* Public Login Route */}
        <Route path="/" element={<Login />} />

        {/* Protected Admin Route */}
        <Route
          path="/admin-dashboard"
          element={(isAuthenticated() && isAdmin()) ? <Layout><AdminDashboard /></Layout> : <Navigate to="/" />}
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

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;