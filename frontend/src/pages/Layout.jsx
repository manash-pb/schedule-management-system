import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Sun, Moon, Bell, Paperclip, MessageCircle, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import gauhatiLogo from '../assets/logo1.png';
import { getAuthData } from '../utils/authStorage';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getAuthData('userRole') || 'user';

  // --- 1. SET UP REACTIVE STATE ---
  const [userName, setUserName] = useState(getAuthData('userName') || 'Student');
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [querySubject, setQuerySubject] = useState('');
  const [queryMessage, setQueryMessage] = useState('');
  const [querySending, setQuerySending] = useState(false);
  const [querySuccess, setQuerySuccess] = useState(false);
  const [queryError, setQueryError] = useState('');

  // --- Support queries list and reply states ---
  const [myQueries, setMyQueries] = useState([]);
  const [activeQueryTab, setActiveQueryTab] = useState('new');
  const [expandedUserQueryId, setExpandedUserQueryId] = useState(null);
  const [hasNewReply, setHasNewReply] = useState(false);
  const [loadingMyQueries, setLoadingMyQueries] = useState(false);

  // Refs for tab indicator & smooth height transition
  const newTabRef = useRef(null);
  const historyTabRef = useRef(null);
  const tabsContainerRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [containerHeight, setContainerHeight] = useState('auto');

  // Track active tab and window dimensions to adjust underline position and width
  useEffect(() => {
    if (!showQueryModal) return;
    const activeRef = activeQueryTab === 'new' ? newTabRef.current : historyTabRef.current;
    if (activeRef) {
      const updateIndicator = () => {
        setIndicatorStyle({
          left: activeRef.offsetLeft,
          width: activeRef.offsetWidth
        });
      };
      
      updateIndicator();
      const timeoutId = setTimeout(updateIndicator, 50); // Fallback for layout settling
      
      window.addEventListener('resize', updateIndicator);
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', updateIndicator);
      };
    }
  }, [activeQueryTab, showQueryModal, hasNewReply]);

  // Dynamically observe the active pane height and update containerHeight
  useEffect(() => {
    if (!showQueryModal) return;
    const activePane = tabsContainerRef.current?.querySelector('.query-tab-pane.active');
    if (activePane) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const height = entry.contentRect.height;
          setContainerHeight(`${height}px`);
        }
      });
      resizeObserver.observe(activePane);
      return () => resizeObserver.disconnect();
    }
  }, [activeQueryTab, showQueryModal, myQueries, loadingMyQueries, querySuccess, queryError, expandedUserQueryId]);

  const fetchMyQueries = async ({ background = false } = {}) => {
    const email = getAuthData('userEmail');
    if (!email || role === 'admin') return;

    if (!background) setLoadingMyQueries(true);
    try {
      const res = await axios.get('/api/queries/my-queries', { withCredentials: true });
      const queries = res.data || [];
      setMyQueries(queries);

      // Check if there is any new reply
      const lastSeenRepliesTime = Number(localStorage.getItem('lastSeenRepliesTime') || '0');
      let foundNewReply = false;
      for (const q of queries) {
        if (q.reply_at) {
          const replyTime = new Date(q.reply_at).getTime();
          if (replyTime > lastSeenRepliesTime) {
            foundNewReply = true;
          }
        }
      }
      setHasNewReply(foundNewReply);
    } catch (err) {
      console.error('Failed to fetch my queries', err);
    } finally {
      if (!background) setLoadingMyQueries(false);
    }
  };

  useEffect(() => {
    if (role !== 'admin') {
      fetchMyQueries({ background: true });
      const socket = io(window.location.origin, { path: '/socket.io' });
      socket.on('support_queries_updated', () => {
        fetchMyQueries({ background: true });
      });
      return () => {
        socket.disconnect();
      };
    }
  }, [role]);

  useEffect(() => {
    if (showQueryModal && activeQueryTab === 'history') {
      localStorage.setItem('lastSeenRepliesTime', Date.now().toString());
      setHasNewReply(false);
    }
  }, [showQueryModal, activeQueryTab]);

  const handleTabChange = (tab) => {
    setActiveQueryTab(tab);
    if (tab === 'history') {
      fetchMyQueries();
      localStorage.setItem('lastSeenRepliesTime', Date.now().toString());
      setHasNewReply(false);
    }
  };

  const handleSubmitQuery = async (e) => {
    e.preventDefault();
    if (!querySubject.trim()) {
      setQueryError('Please enter a query subject before sending.');
      return;
    }
    if (!queryMessage.trim()) {
      setQueryError('Please describe your question before sending.');
      return;
    }

    setQuerySending(true);
    setQueryError('');
    try {
      const res = await axios.post('/api/queries', {
        subject: querySubject,
        message: queryMessage,
      }, { withCredentials: true });

      if (res.data && res.data.success) {
        setQuerySuccess(true);
        setQuerySubject('');
        setQueryMessage('');
        fetchMyQueries({ background: true }); // Refetch query history
        setTimeout(() => {
          setQuerySuccess(false);
          setShowQueryModal(false);
        }, 1800);
      } else {
        throw new Error(res.data?.error || 'Failed to send query');
      }
    } catch (err) {
      console.error('Query submit failed', err);
      setQueryError(err.response?.data?.error || err.message || 'Failed to send query');
    } finally {
      setQuerySending(false);
    }
  };

  const handleDeleteQuery = async (queryId) => {
    if (!window.confirm('Are you sure you want to delete this query from your history?')) return;
    try {
      await axios.delete(`/api/queries/${queryId}`, { withCredentials: true });
      setMyQueries(prev => prev.filter(q => q.id !== queryId));
      if (expandedUserQueryId === queryId) {
        setExpandedUserQueryId(null);
      }
    } catch (err) {
      console.error('Failed to delete query', err);
      alert(err.response?.data?.error || err.message || 'Failed to delete query.');
    }
  };

  const handleClearMyHistory = async () => {
    if (!window.confirm('Are you sure you want to clear your entire support query history? This cannot be undone.')) return;
    try {
      await axios.delete('/api/queries/clear/my-history', { withCredentials: true });
      setMyQueries([]);
      setExpandedUserQueryId(null);
    } catch (err) {
      console.error('Failed to clear history', err);
      alert(err.response?.data?.error || err.message || 'Failed to clear query history.');
    }
  };

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

    // Socket.io connection for real-time bell updates
    const socket = io('http://localhost:3000', {
        withCredentials: true
    });

    socket.on('new_notification_posted', (newNotification) => {
        const formattedNotif = {
            id: newNotification.id,
            subject: newNotification.subject,
            text: newNotification.message,
            time: new Date().toLocaleString(),
            attachments: [],
            read: false
        };
        setNotifications(prev => [formattedNotif, ...prev]);
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
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

      {role !== 'admin' && (
        <>
          <button
            onClick={() => setShowQueryModal(true)}
            className="floating-query-button"
            title="Ask admins a question"
            style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 90 }}
          >
            <MessageCircle size={24} />
            {hasNewReply && (
              <span style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 12,
                height: 12,
                backgroundColor: '#ef4444',
                borderRadius: '50%',
                border: '2px solid #2563eb',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }} />
            )}
          </button>

          {showQueryModal && (
            <div className="query-modal-overlay" onClick={() => setShowQueryModal(false)}>
              <div className="query-modal-card" onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22 }}>Support Queries</h2>
                    <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>Ask questions or view administrative responses.</p>
                  </div>
                  <button
                    onClick={() => setShowQueryModal(false)}
                    className="btn-icon"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                    aria-label="Close queries panel"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div style={{ position: 'relative', display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, gap: 16 }}>
                  <button
                    ref={newTabRef}
                    type="button"
                    onClick={() => handleTabChange('new')}
                    style={{
                      padding: '10px 4px',
                      background: 'none',
                      border: 'none',
                      color: activeQueryTab === 'new' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      transition: 'color 0.2s ease',
                    }}
                  >
                    Ask a Question
                  </button>
                  <button
                    ref={historyTabRef}
                    type="button"
                    onClick={() => handleTabChange('history')}
                    style={{
                      padding: '10px 4px',
                      background: 'none',
                      border: 'none',
                      color: activeQueryTab === 'history' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      transition: 'color 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    My Queries & Replies
                    {hasNewReply && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                    )}
                  </button>

                  {/* Sliding Underline Indicator */}
                  <div style={{
                    position: 'absolute',
                    bottom: -1,
                    left: indicatorStyle.left,
                    width: indicatorStyle.width,
                    height: '2px',
                    backgroundColor: '#2563eb',
                    transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
                  }} />
                </div>

                <div
                  ref={tabsContainerRef}
                  className="query-tabs-wrapper"
                  style={{
                    height: containerHeight,
                    transition: 'height 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
                  }}
                >
                  <div className={`query-tab-pane ${activeQueryTab === 'new' ? 'active' : 'inactive-left'}`}>
                    <form onSubmit={handleSubmitQuery} className="query-tab-content" style={{ margin: 0 }}>
                      <input
                        type="text"
                        placeholder="Subject"
                        value={querySubject}
                        onChange={(e) => setQuerySubject(e.target.value)}
                        className="custom-input query-input"
                        required
                      />
                      <textarea
                        placeholder="Describe your question or issue..."
                        value={queryMessage}
                        onChange={(e) => setQueryMessage(e.target.value)}
                        className="custom-input query-textarea"
                        required
                      />

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 16 }}>
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={querySending}
                          style={{
                            height: '34px',
                            padding: '0 16px',
                            fontSize: '13px',
                            width: 'auto',
                            marginTop: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {querySending ? 'Sending…' : 'Send Query'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQueryModal(false)}
                          className="btn-secondary"
                          style={{
                            height: '34px',
                            padding: '0 16px',
                            fontSize: '13px',
                            width: 'auto',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          Cancel
                        </button>
                        {querySuccess && <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '13px' }}>Query sent!</span>}
                        {queryError && <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '13px' }}>{queryError}</span>}
                      </div>
                    </form>
                  </div>

                  <div className={`query-tab-pane ${activeQueryTab === 'history' ? 'active' : 'inactive-right'}`}>
                    <div className="query-tab-content">
                      {loadingMyQueries ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          Loading queries history...
                        </div>
                      ) : myQueries.length === 0 ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                          You haven't submitted any queries yet.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                            <button
                              type="button"
                              onClick={handleClearMyHistory}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                background: 'transparent',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ef4444';
                                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
                                e.currentTarget.style.background = 'rgba(239,68,68,0.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-secondary)';
                                e.currentTarget.style.borderColor = 'var(--border)';
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <Trash2 size={13} />
                              Clear History
                            </button>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                          {myQueries.map((query) => {
                            const isExpanded = expandedUserQueryId === query.id;
                            const hasReply = !!query.reply_message;
                            
                            return (
                              <div
                                key={query.id}
                                style={{
                                  padding: 16,
                                  borderRadius: 16,
                                  background: 'var(--bg-muted)',
                                  border: '1px solid var(--border)',
                                  transition: 'all 0.2s',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {query.subject}
                                    </p>
                                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                                      Asked on {new Date(query.created_at).toLocaleDateString()} at {new Date(query.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    {hasReply ? (
                                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 9999, background: '#dcfce7', color: '#15803d', textTransform: 'uppercase' }}>
                                        Answered
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 9999, background: '#fef3c7', color: '#b45309', textTransform: 'uppercase' }}>
                                        Pending
                                      </span>
                                    )}
                                    
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteQuery(query.id)}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: 8,
                                        padding: '6px',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        marginRight: 2
                                      }}
                                      title="Delete query"
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = '#ef4444';
                                        e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = 'var(--text-muted)';
                                        e.currentTarget.style.background = 'transparent';
                                      }}
                                    >
                                      <Trash2 size={14} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setExpandedUserQueryId(isExpanded ? null : query.id)}
                                      style={{
                                        background: 'var(--bg-input)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                        padding: '4px 8px',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                      }}
                                    >
                                      {isExpanded ? 'Hide' : 'View'}
                                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                                    <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 10, fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.5 }}>
                                      <p style={{ margin: 0, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Your Question:</p>
                                      {query.message}
                                    </div>

                                    {hasReply ? (
                                      <div style={{ marginTop: 12, background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(29,78,216,0.06))', border: '1px solid rgba(37,99,235,0.15)', padding: 12, borderRadius: 10, fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.5 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                                          <span style={{ fontWeight: 700, fontSize: 11, color: '#2563eb', textTransform: 'uppercase' }}>Admin Reply:</span>
                                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                            {query.reply_at ? new Date(query.reply_at).toLocaleDateString() : ''} · {query.replied_by || 'Admin'}
                                          </span>
                                        </div>
                                        {query.reply_message}
                                      </div>
                                    ) : (
                                      <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-input)', border: '1px dashed var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#b45309', display: 'inline-block' }} />
                                        Waiting for admin reply...
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

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