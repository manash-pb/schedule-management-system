import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Sun, Moon, Bell, Paperclip } from 'lucide-react';
import gauhatiLogo from '../assets/logo1.png';
import { getAuthData } from '../utils/authStorage';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getAuthData('userRole') || 'user';

  // --- 1. SET UP REACTIVE STATE ---
  const [userName, setUserName] = useState(getAuthData('userName') || 'Student');
  const [userPic, setUserPic] = useState(getAuthData('userPicture'));
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [newNotification, setNewNotification] = useState('');
  const [creatingNotif, setCreatingNotif] = useState(false);

  // Fetch real notifications
  const fetchNotifications = async () => {
    const email = getAuthData('userEmail');
    if (!email) return;
    try {
      const res = await axios.get('/api/notifications', { params: { email }, withCredentials: true });
      setNotifications(res.data);
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Optional: poll for new notifications every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle clicking outside to close notifications
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const displayedNotifications = notifications.slice(0, 3);

  const markAllAsRead = async () => {
    const email = getAuthData('userEmail');
    if (!email) return;

    try {
      await axios.post('/api/notifications/read', { email }, { withCredentials: true });
      // Optimistically update UI
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error("Failed to mark notifications as read", e);
    }
  };

  const handleCreateNotification = async (e) => {
    e.preventDefault();
    if (!newNotification.trim()) return;
    setCreatingNotif(true);
    try {
      await axios.post('/api/notifications', { message: newNotification }, { withCredentials: true });
      setNewNotification('');
      fetchNotifications();
    } catch (e) { 
      console.error("Failed to create notification", e);
    } finally {
      setCreatingNotif(false);
    }
  };



  // --- 2. LISTEN FOR BROADCASTS ---
  useEffect(() => {
    const syncProfileData = () => {
      // This runs whenever UserProfile calls window.dispatchEvent(new Event("storage"))
      setUserName(getAuthData('userName') || 'Student');
      setUserPic(getAuthData('userPicture'));
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

            {location.pathname !== '/notifications' && (
              <div className="relative" ref={notificationRef}>
                <button 
                  onClick={() => setShowNotifications(!showNotifications)} 
                  className="btn-secondary theme-btn" 
                  style={{ padding: '0', position: 'relative', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}
                >
                <Bell size={18} style={{ transform: 'rotate(15deg)' }} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '-2px', right: '-2px',
                    backgroundColor: '#ef4444', color: 'white',
                    fontSize: '10px', fontWeight: 'bold',
                    width: '16px', height: '16px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid var(--bg-card)'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="notification-dropdown floating-card absolute right-0 top-full mt-2 w-80 z-50 p-0 overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 rounded-xl" style={{ backgroundColor: 'var(--bg-card)' }}>


                  <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-bold m-0" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 bg-transparent border-none cursor-pointer font-medium p-0"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto">
                    {displayedNotifications.length > 0 ? (
                      displayedNotifications.map(notification => (
                        <div 
                          key={notification.id} 
                          className={`p-4 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex justify-between items-start ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                        >
                          <div style={{ flex: 1, paddingRight: '10px' }}>
                            <p className="text-sm m-0 mb-1" style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{notification.text}</p>
                            {notification.attachments && notification.attachments.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '6px' }}>
                                {notification.attachments.map(att => (
                                  <div key={att.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <Paperclip size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <a href={att.url} target="_blank" rel="noreferrer" className="attachment-link" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                      {att.name || 'Attachment'}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{notification.time}</span>
                          </div>

                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                        No new notifications
                      </div>
                    )}
                    
                    <button 
                        onClick={() => {
                          setShowNotifications(false);
                          navigate('/notifications');
                        }}
                        style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', color: '#2563eb', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        View all
                      </button>
                  </div>

                  {role === 'admin' && (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
                      <button
                        onClick={() => { setShowNotifications(false); navigate('/admin/post-notification'); }}
                        className="btn-primary"
                        style={{ width: '100%', padding: '8px 12px', fontSize: '14px', fontWeight: 700 }}
                      >
                        Post Notifications
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
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