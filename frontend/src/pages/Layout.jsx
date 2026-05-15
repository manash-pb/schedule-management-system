import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import gauhatiLogo from '../assets/logo1.png';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const role = localStorage.getItem('userRole') || 'user';

  // --- 1. SET UP REACTIVE STATE ---
  const [userName, setUserName] = useState(localStorage.getItem('userName') || 'Student');
  const [userPic, setUserPic] = useState(localStorage.getItem('userPicture'));
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  // --- 2. LISTEN FOR BROADCASTS ---
  useEffect(() => {
    const syncProfileData = () => {
      // This runs whenever UserProfile calls window.dispatchEvent(new Event("storage"))
      setUserName(localStorage.getItem('userName') || 'Student');
      setUserPic(localStorage.getItem('userPicture'));
    };

    window.addEventListener('storage', syncProfileData);
    return () => window.removeEventListener('storage', syncProfileData);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const dashboardPath = role === 'admin' ? '/admin-dashboard' : '/user-dashboard';
  const links = [{ to: dashboardPath, label: 'Dashboard' }];

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

          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button onClick={() => setDarkMode(d => !d)} className="btn-secondary theme-btn" style={{ padding: '8px' }}>
              <div className="relative w-4 h-4 flex items-center justify-center">
                <Sun size={16} className={`absolute transition-all duration-500 ${!darkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`} />
                <Moon size={16} className={`absolute transition-all duration-500 ${darkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'}`} />
              </div>
            </button>

            <button
              onClick={() => navigate('/profile')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                {/* 3. USE STATE VARIABLES INSTEAD OF CONSTANTS */}
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{userName}</span>
                <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{role}</span>
              </div>

              <div style={{
                background: '#2563eb', color: '#fff',
                borderRadius: '50%', width: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                overflow: 'hidden'
              }}>
                {/* 4. UPDATED IMAGE LOGIC */}
                {userPic && userPic !== 'null' && userPic !== 'undefined' ? (
                  <img src={userPic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  userName.charAt(0).toUpperCase()
                )}
              </div>
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