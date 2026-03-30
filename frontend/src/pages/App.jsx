import React from 'react';
import './App.css'; // This looks for App.css in the same folder as App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';

// You can move CustomTimeInput into its own file, or keep it here and pass it
const CustomTimeInput = ({ value, onChange }) => {
    // ... Copy your CustomTimeInput component code here ...
};

function App() {
  const isAuthenticated = () => localStorage.getItem('isAdminLoggedIn') === 'true';

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Protected Route Logic */}
        <Route 
          path="/dashboard" 
          element={isAuthenticated() ? <Dashboard CustomTimeInput={CustomTimeInput} /> : <Navigate to="/" />} 
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;