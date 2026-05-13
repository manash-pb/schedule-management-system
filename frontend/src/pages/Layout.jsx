import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import gauhatiLogo from '../assets/logo1.png';

const Layout = ({ children }) => {
  const role = localStorage.getItem('userRole') || 'user';
  const name = localStorage.getItem('userName') || 'Student';
  const dashboardPath = role === 'admin' ? '/admin-dashboard' : '/user-dashboard';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const links = [
    { to: dashboardPath, label: 'Dashboard' },
    { to: '/profile', label: 'Profile' }
  ];

  const handleLogout = () => {
    localStorage.removeItem('isAdminLoggedIn');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    navigate('/');
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="header-brand">
            <img src={gauhatiLogo} alt="Gauhati University logo" className="brand-mark" />
            <div>
              <div className="brand-title">Gauhati University</div>
              <div className="brand-subtitle">Schedule Management System</div>
            </div>
          </div>

          <nav className="nav-links">
            {links.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="header-actions">
            <button onClick={() => setDarkMode(d => !d)} className="btn-secondary theme-btn">
              <div className="relative w-4 h-4 flex items-center justify-center">
                <Sun size={16} className={`absolute transition-all duration-500 ${!darkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`} />
                <Moon size={16} className={`absolute transition-all duration-500 ${darkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'}`} />
              </div>
            </button>
            <div className="user-pill">
              <span>{name}</span>
              <span className="user-role">{role.toUpperCase()}</span>
            </div>
            <button type="button" className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="main-shell">{children}</main>

      <footer className="app-footer">
        <div className="footer-inner">
          <div>© 2026 Schedule Management System · v1.0</div>
          <div className="footer-links">
            <a href="#help" className="footer-link">Help</a>
            <a href="#privacy" className="footer-link">Privacy</a>
            <a href="#terms" className="footer-link">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
